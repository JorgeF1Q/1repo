<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');

require __DIR__ . '/db.php';
require __DIR__ . '/products-lib.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    respond_json(204);
}

if ($method !== 'POST') {
    respond_error(405, 'Método no permitido. Usa POST.');
}

try {
    $productSchema = ensure_products_schema($pdo);
    $imageSchema = ensure_images_schema($pdo, $productSchema);
} catch (Throwable $e) {
    respond_error(500, 'No se pudo preparar el servicio de imágenes.', ['detail' => $e->getMessage()]);
}

$productId = isset($_POST['product_id']) ? (int) $_POST['product_id'] : (isset($_GET['product_id']) ? (int) $_GET['product_id'] : 0);
if ($productId <= 0) {
    respond_error(400, 'Falta el identificador del producto.');
}

$product = fetch_product_row($pdo, $productSchema, $imageSchema, $productId);
if (!$product) {
    respond_error(404, 'Producto no encontrado.');
}

if (!isset($_FILES['file'])) {
    respond_error(400, 'No se recibió ningún archivo.');
}

$file = $_FILES['file'];
if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    $errorCode = $file['error'] ?? UPLOAD_ERR_NO_FILE;
    $messages = [
        UPLOAD_ERR_INI_SIZE => 'El archivo excede el tamaño permitido por el servidor.',
        UPLOAD_ERR_FORM_SIZE => 'El archivo excede el tamaño permitido por el formulario.',
        UPLOAD_ERR_PARTIAL => 'El archivo se subió de forma incompleta.',
        UPLOAD_ERR_NO_FILE => 'No se seleccionó ningún archivo.',
        UPLOAD_ERR_NO_TMP_DIR => 'Falta la carpeta temporal en el servidor.',
        UPLOAD_ERR_CANT_WRITE => 'No se pudo guardar el archivo en disco.',
        UPLOAD_ERR_EXTENSION => 'Una extensión bloqueó la carga del archivo.',
    ];
    $message = $messages[$errorCode] ?? 'Error al subir la imagen.';
    respond_error(400, $message, ['code' => $errorCode]);
}

$tmpPath = $file['tmp_name'] ?? null;
if (!$tmpPath || !is_uploaded_file($tmpPath)) {
    respond_error(400, 'El archivo subido no es válido.');
}

$size = (int) ($file['size'] ?? 0);
$maxBytes = 5 * 1024 * 1024; // 5 MB
if ($size > $maxBytes) {
    respond_error(413, 'La imagen es demasiado grande. Máximo 5 MB.');
}

$binary = file_get_contents($tmpPath);
if ($binary === false || $binary === '') {
    respond_error(400, 'No se pudo leer el archivo subido.');
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($tmpPath) ?: ($file['type'] ?? 'application/octet-stream');
if (strpos($mime, 'image/') !== 0) {
    respond_error(415, 'Solo se permiten archivos de imagen.');
}

$filename = $file['name'] ?? null;

try {
    $pdo->beginTransaction();

    $existing = null;
    if (!empty($imageSchema['table'])) {
        $stmt = $pdo->prepare(
            'SELECT ' . $imageSchema['id'] . ' AS imagen_id
             FROM ' . $imageSchema['table'] . '
             WHERE ' . $imageSchema['product_fk'] . ' = :id
             ORDER BY ' . $imageSchema['id'] . ' ASC
             LIMIT 1'
        );
        $stmt->execute([':id' => $productId]);
        $existing = $stmt->fetch();
    }

    if ($existing && isset($existing['imagen_id'])) {
        $stmt = $pdo->prepare(
            'UPDATE ' . $imageSchema['table'] . '
             SET ' . $imageSchema['blob'] . ' = :blob,
                 ' . $imageSchema['mime'] . ' = :mime,
                 ' . $imageSchema['url'] . ' = NULL,
                 ' . $imageSchema['filename'] . ' = :filename
             WHERE ' . $imageSchema['id'] . ' = :id'
        );
        $stmt->execute([
            ':blob' => $binary,
            ':mime' => $mime,
            ':filename' => $filename,
            ':id' => $existing['imagen_id'],
        ]);
        $imageId = (int) $existing['imagen_id'];
    } else {
        $stmt = $pdo->prepare(
            'INSERT INTO ' . $imageSchema['table'] . ' (' . $imageSchema['product_fk'] . ', ' . $imageSchema['blob'] . ', ' . $imageSchema['mime'] . ', ' . $imageSchema['url'] . ', ' . $imageSchema['filename'] . ')
             VALUES (:product_id, :blob, :mime, NULL, :filename)'
        );
        $stmt->execute([
            ':product_id' => $productId,
            ':blob' => $binary,
            ':mime' => $mime,
            ':filename' => $filename,
        ]);
        $imageId = (int) $pdo->lastInsertId();
    }

    $dataUrl = build_data_url($mime, $binary, null);
    if (!empty($productSchema['image']) && $dataUrl !== null) {
        $stmt = $pdo->prepare(
            'UPDATE ' . $productSchema['table'] . ' SET ' . $productSchema['image'] . ' = :url WHERE ' . $productSchema['id'] . ' = :id'
        );
        $stmt->execute([
            ':url' => $dataUrl,
            ':id' => $productId,
        ]);
    }

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    respond_error(500, 'No se pudo guardar la imagen.', ['detail' => $e->getMessage()]);
}

respond_json(200, [
    'ok' => true,
    'product_id' => $productId,
    'image_id' => $imageId,
    'mime' => $mime,
    'size' => $size,
    'url' => $dataUrl,
]);
