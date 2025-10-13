<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');

require __DIR__ . '/db.php';
require __DIR__ . '/products-lib.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    respond_json(204);
}

if ($method !== 'GET') {
    respond_error(405, 'Método no permitido.');
}

try {
    $productSchema = ensure_products_schema($pdo);
} catch (Throwable $e) {
    respond_error(500, 'No se pudo preparar el servicio de categorías.', ['detail' => $e->getMessage()]);
}

$column = $productSchema['category'];
if (!$column) {
    respond_json(200, ['ok' => true, 'categories' => []]);
}

$sql = 'SELECT DISTINCT ' . $column . ' AS categoria FROM ' . $productSchema['table'] . ' WHERE ' . $column . ' IS NOT NULL AND TRIM(' . $column . ") <> '' ORDER BY " . $column;
$stmt = $pdo->query($sql);
$rows = $stmt ? $stmt->fetchAll(PDO::FETCH_COLUMN) : [];

$categories = [];
foreach ($rows as $row) {
    $text = trim((string) $row);
    if ($text !== '' && !in_array($text, $categories, true)) {
        $categories[] = $text;
    }
}

respond_json(200, ['ok' => true, 'categories' => $categories]);
