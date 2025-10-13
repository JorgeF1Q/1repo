<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');

require __DIR__ . '/db.php';
require __DIR__ . '/products-lib.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    respond_json(204);
}

try {
    $productSchema = ensure_products_schema($pdo);
    $imageSchema = ensure_images_schema($pdo, $productSchema);
} catch (Throwable $e) {
    respond_error(500, 'No se pudo preparar el servicio de productos.', ['detail' => $e->getMessage()]);
}

function build_product_fields(array $payload, array $productSchema): array
{
    $fields = [];

    $code = normalize_string(extract_field($payload, ['Codigo', 'codigo', 'SKU', 'sku', 'clave', 'code']));
    if ($code !== null && !empty($productSchema['code'])) {
        $fields[$productSchema['code']] = $code;
    }

    $name = normalize_string(extract_field($payload, ['Nombre', 'nombre', 'name', 'Titulo', 'titulo', 'descripcion', 'Descripcion']));
    if ($name !== null && !empty($productSchema['name'])) {
        $fields[$productSchema['name']] = $name;
    }

    $priceValue = extract_field($payload, ['Precio', 'precio', 'price', 'costo']);
    $price = normalize_numeric($priceValue, false);
    if ($price !== null && !empty($productSchema['price'])) {
        $fields[$productSchema['price']] = $price;
    }

    $stockValue = extract_field($payload, ['Stock', 'stock', 'existencia', 'cantidad']);
    $stock = normalize_int($stockValue, false);
    if ($stock !== null && !empty($productSchema['stock'])) {
        $fields[$productSchema['stock']] = $stock;
    }

    $activeValue = extract_field($payload, ['Activo', 'activo', 'estado', 'estatus', 'habilitado']);
    if (!empty($productSchema['active'])) {
        $fields[$productSchema['active']] = normalize_bool_flag($activeValue);
    }

    $category = normalize_string(extract_field($payload, ['Categoria', 'categoria', 'category']));
    if ($category !== null && !empty($productSchema['category'])) {
        $fields[$productSchema['category']] = $category;
    }

    $material = normalize_string(extract_field($payload, ['Material', 'material']));
    if ($material !== null && !empty($productSchema['material'])) {
        $fields[$productSchema['material']] = $material;
    }

    $image = extract_field($payload, ['ImagenUrl', 'imagenUrl', 'imagenurl', 'image', 'imageUrl', 'url_imagen']);
    if ($image !== null && !empty($productSchema['image'])) {
        $fields[$productSchema['image']] = normalize_string($image);
    }

    $description = normalize_string(extract_field($payload, ['Descripcion', 'descripcion', 'detalle', 'detalleProducto']));
    if ($description !== null && !empty($productSchema['description'])) {
        $fields[$productSchema['description']] = $description;
    }

    return $fields;
}

function insert_product(PDO $pdo, array $productSchema, array $fields): int
{
    if (!$fields) {
        respond_error(422, 'No se enviaron campos para crear el producto.');
    }

    $columns = [];
    $placeholders = [];
    $params = [];
    $index = 0;
    foreach ($fields as $column => $value) {
        $columns[] = $column;
        $placeholder = ':p' . $index++;
        $placeholders[] = $placeholder;
        $params[$placeholder] = $value;
    }

    $sql = 'INSERT INTO ' . $productSchema['table'] . ' (' . implode(', ', $columns) . ')
            VALUES (' . implode(', ', $placeholders) . ')';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    return (int) $pdo->lastInsertId();
}

function update_product(PDO $pdo, array $productSchema, int $id, array $fields): void
{
    if (!$fields) {
        respond_error(422, 'No se enviaron cambios para actualizar.');
    }

    $sets = [];
    $params = [];
    $index = 0;
    foreach ($fields as $column => $value) {
        $placeholder = ':p' . $index++;
        $sets[] = $column . ' = ' . $placeholder;
        $params[$placeholder] = $value;
    }
    $params[':id'] = $id;

    $sql = 'UPDATE ' . $productSchema['table'] . ' SET ' . implode(', ', $sets) . ' WHERE ' . $productSchema['id'] . ' = :id';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
}

function delete_product(PDO $pdo, array $productSchema, array $imageSchema, int $id): void
{
    $pdo->beginTransaction();
    try {
        if (!empty($imageSchema['table'])) {
            $stmt = $pdo->prepare('DELETE FROM ' . $imageSchema['table'] . ' WHERE ' . $imageSchema['product_fk'] . ' = :id');
            $stmt->execute([':id' => $id]);
        }
        $stmt = $pdo->prepare('DELETE FROM ' . $productSchema['table'] . ' WHERE ' . $productSchema['id'] . ' = :id');
        $stmt->execute([':id' => $id]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

$id = isset($_GET['id']) ? (int) $_GET['id'] : null;

try {
    switch ($method) {
        case 'GET':
            if ($id) {
                $product = fetch_product_row($pdo, $productSchema, $imageSchema, $id);
                if (!$product) {
                    respond_error(404, 'Producto no encontrado.');
                }
                respond_json(200, ['ok' => true, 'product' => $product]);
            }
            $list = fetch_products($pdo, $productSchema, $imageSchema);
            respond_json(200, ['ok' => true, 'count' => count($list), 'products' => $list]);

        case 'POST':
            $payload = read_json_input();
            $fields = build_product_fields($payload, $productSchema);
            if (!empty($productSchema['name']) && !array_key_exists($productSchema['name'], $fields)) {
                respond_error(422, 'El nombre del producto es obligatorio.');
            }
            $id = insert_product($pdo, $productSchema, $fields);
            $product = fetch_product_row($pdo, $productSchema, $imageSchema, $id);
            respond_json(201, ['ok' => true, 'product' => $product]);

        case 'PUT':
        case 'PATCH':
            if (!$id) {
                respond_error(400, 'Falta el identificador del producto.');
            }
            $payload = read_json_input();
            $fields = build_product_fields($payload, $productSchema);
            update_product($pdo, $productSchema, $id, $fields);
            $product = fetch_product_row($pdo, $productSchema, $imageSchema, $id);
            respond_json(200, ['ok' => true, 'product' => $product]);

        case 'DELETE':
            if (!$id) {
                respond_error(400, 'Falta el identificador del producto.');
            }
            delete_product($pdo, $productSchema, $imageSchema, $id);
            respond_json(200, ['ok' => true]);

        default:
            respond_error(405, 'Método no permitido.');
    }
} catch (InvalidArgumentException $e) {
    respond_error(422, $e->getMessage());
} catch (RuntimeException $e) {
    respond_error(404, $e->getMessage());
} catch (Throwable $e) {
    respond_error(500, 'Ocurrió un error al procesar la solicitud de productos.', ['detail' => $e->getMessage()]);
}
