<?php
declare(strict_types=1);

function respond_json(int $status, array $payload = []): void
{
    http_response_code($status);
    if ($status === 204) {
        exit;
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function respond_error(int $status, string $message, array $extra = []): void
{
    $payload = array_merge(['error' => $message], $extra);
    respond_json($status, $payload);
}

function read_json_input(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
        return [];
    }
    return $data;
}

function table_exists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table'
    );
    $stmt->execute([':table' => $table]);
    return (int) $stmt->fetchColumn() > 0;
}

function column_exists(PDO $pdo, string $table, string $column): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column'
    );
    $stmt->execute([
        ':table' => $table,
        ':column' => $column,
    ]);
    return (int) $stmt->fetchColumn() > 0;
}

function detect_table(PDO $pdo, array $candidates): ?string
{
    foreach ($candidates as $candidate) {
        if (table_exists($pdo, $candidate)) {
            return $candidate;
        }
    }
    return null;
}

function detect_column(PDO $pdo, string $table, array $candidates): ?string
{
    foreach ($candidates as $candidate) {
        if (column_exists($pdo, $table, $candidate)) {
            return $candidate;
        }
    }
    return null;
}

function ensure_products_schema(PDO $pdo): array
{
    $schema = [
        'table' => null,
        'id' => null,
        'code' => null,
        'name' => null,
        'price' => null,
        'stock' => null,
        'active' => null,
        'category' => null,
        'material' => null,
        'image' => null,
        'description' => null,
    ];

    $schema['table'] = detect_table($pdo, ['producto', 'productos', 'articulo', 'articulos', 'product', 'products']);
    if (!$schema['table']) {
        respond_error(500, 'No se encontró la tabla de productos.');
    }

    $table = $schema['table'];
    $schema['id'] = detect_column($pdo, $table, ['producto_id', 'id', 'product_id', 'articulo_id']);
    if (!$schema['id']) {
        respond_error(500, 'No se encontró la columna de identificador de productos.');
    }

    $schema['code'] = detect_column($pdo, $table, ['codigo', 'sku', 'clave', 'code']);
    $schema['name'] = detect_column($pdo, $table, ['nombre', 'titulo', 'name', 'descripcion']);
    $schema['price'] = detect_column($pdo, $table, ['precio', 'price', 'costo']);
    $schema['stock'] = detect_column($pdo, $table, ['stock', 'existencia', 'existencias', 'cantidad']);
    $schema['active'] = detect_column($pdo, $table, ['activo', 'estado', 'estatus', 'habilitado']);
    $schema['category'] = detect_column($pdo, $table, ['categoria', 'categoria_id', 'category', 'categoria_nombre']);
    $schema['material'] = detect_column($pdo, $table, ['material', 'material_id', 'material_nombre']);
    $schema['image'] = detect_column($pdo, $table, ['imagen', 'imagen_url', 'imagenurl', 'image', 'image_url', 'url_imagen']);
    $schema['description'] = detect_column($pdo, $table, ['descripcion', 'description', 'detalle']);

    return $schema;
}

function ensure_images_schema(PDO $pdo, array $productSchema): array
{
    $schema = [
        'table' => detect_table($pdo, ['imagenes_producto', 'imagen_producto', 'producto_imagen', 'producto_imagenes', 'product_images', 'product_image', 'imagenes', 'imagen']),
        'id' => null,
        'product_fk' => null,
        'url' => null,
        'blob' => null,
        'mime' => null,
        'filename' => null,
        'created_at' => null,
    ];

    if (!$schema['table']) {
        $schema['table'] = 'imagenes_producto';
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS imagenes_producto (
                imagen_id INT NOT NULL AUTO_INCREMENT,
                producto_id INT NOT NULL,
                url TEXT NULL,
                imagen_blob LONGBLOB NULL,
                mime_type VARCHAR(120) NULL,
                nombre_archivo VARCHAR(255) NULL,
                creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (imagen_id),
                INDEX idx_producto (producto_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    }

    $table = $schema['table'];
    $schema['id'] = detect_column($pdo, $table, ['imagen_id', 'id', 'image_id']);
    if (!$schema['id']) {
        $schema['id'] = 'imagen_id';
        if (!column_exists($pdo, $table, $schema['id'])) {
            $pdo->exec('ALTER TABLE ' . $table . ' ADD COLUMN imagen_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST');
        }
    }

    $schema['product_fk'] = detect_column($pdo, $table, ['producto_id', 'product_id', 'articulo_id', 'id_producto']);
    if (!$schema['product_fk']) {
        $schema['product_fk'] = 'producto_id';
        if (!column_exists($pdo, $table, $schema['product_fk'])) {
            $pdo->exec('ALTER TABLE ' . $table . ' ADD COLUMN ' . $schema['product_fk'] . ' INT NOT NULL');
            $pdo->exec('CREATE INDEX IF NOT EXISTS idx_producto_fk ON ' . $table . ' (' . $schema['product_fk'] . ')');
        }
    }

    $schema['url'] = detect_column($pdo, $table, ['url', 'ruta', 'path', 'enlace']);
    if (!$schema['url']) {
        $schema['url'] = 'url';
        if (!column_exists($pdo, $table, $schema['url'])) {
            $pdo->exec('ALTER TABLE ' . $table . ' ADD COLUMN ' . $schema['url'] . ' TEXT NULL');
        }
    }

    $schema['blob'] = detect_column($pdo, $table, ['imagen_blob', 'blob', 'contenido', 'data']);
    if (!$schema['blob']) {
        $schema['blob'] = 'imagen_blob';
        if (!column_exists($pdo, $table, $schema['blob'])) {
            $pdo->exec('ALTER TABLE ' . $table . ' ADD COLUMN ' . $schema['blob'] . ' LONGBLOB NULL');
        }
    }

    $schema['mime'] = detect_column($pdo, $table, ['mime_type', 'mime', 'tipo_contenido']);
    if (!$schema['mime']) {
        $schema['mime'] = 'mime_type';
        if (!column_exists($pdo, $table, $schema['mime'])) {
            $pdo->exec('ALTER TABLE ' . $table . ' ADD COLUMN ' . $schema['mime'] . ' VARCHAR(120) NULL');
        }
    }

    $schema['filename'] = detect_column($pdo, $table, ['nombre_archivo', 'filename', 'archivo']);
    if (!$schema['filename']) {
        $schema['filename'] = 'nombre_archivo';
        if (!column_exists($pdo, $table, $schema['filename'])) {
            $pdo->exec('ALTER TABLE ' . $table . ' ADD COLUMN ' . $schema['filename'] . ' VARCHAR(255) NULL');
        }
    }

    $schema['created_at'] = detect_column($pdo, $table, ['creado_en', 'created_at', 'fecha_creacion']);
    if (!$schema['created_at']) {
        $schema['created_at'] = 'creado_en';
        if (!column_exists($pdo, $table, $schema['created_at'])) {
            $pdo->exec('ALTER TABLE ' . $table . ' ADD COLUMN ' . $schema['created_at'] . ' TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
        }
    }

    if (!empty($productSchema['table']) && !empty($productSchema['id'])) {
        $fkName = 'fk_' . $schema['table'] . '_' . $productSchema['table'];
        try {
            $pdo->exec(
                'ALTER TABLE ' . $schema['table'] . ' ADD CONSTRAINT ' . $fkName .
                ' FOREIGN KEY (' . $schema['product_fk'] . ') REFERENCES ' . $productSchema['table'] . '(' . $productSchema['id'] . ')
                 ON DELETE CASCADE ON UPDATE CASCADE'
            );
        } catch (Throwable $e) {
            // Ignorar si ya existe
        }
    }

    return $schema;
}

function build_data_url(?string $mime, ?string $blob, ?string $fallbackUrl = null): ?string
{
    if ($blob !== null && $blob !== '') {
        $type = $mime ?: 'image/jpeg';
        $base64 = base64_encode($blob);
        return 'data:' . $type . ';base64,' . $base64;
    }
    if ($fallbackUrl !== null && $fallbackUrl !== '') {
        return $fallbackUrl;
    }
    return null;
}

function map_product_row(array $row, array $productSchema, ?array $imageRow = null): array
{
    $idKey = $productSchema['id'];
    $codeKey = $productSchema['code'];
    $nameKey = $productSchema['name'];
    $priceKey = $productSchema['price'];
    $stockKey = $productSchema['stock'];
    $activeKey = $productSchema['active'];
    $categoryKey = $productSchema['category'];
    $materialKey = $productSchema['material'];
    $imageKey = $productSchema['image'];
    $descriptionKey = $productSchema['description'];

    $id = isset($row[$idKey]) ? (int) $row[$idKey] : null;

    $price = null;
    if ($priceKey && isset($row[$priceKey]) && is_numeric($row[$priceKey])) {
        $price = (float) $row[$priceKey];
    }

    $stock = null;
    if ($stockKey && isset($row[$stockKey]) && $row[$stockKey] !== null && $row[$stockKey] !== '') {
        $stock = (int) $row[$stockKey];
    }

    $active = 1;
    if ($activeKey && array_key_exists($activeKey, $row)) {
        $value = $row[$activeKey];
        if (is_numeric($value)) {
            $active = (int) $value ? 1 : 0;
        } else {
            $text = strtolower(trim((string) $value));
            $active = in_array($text, ['1', 'true', 'activo', 'habilitado', 'disponible', 'yes', 'si'], true) ? 1 : 0;
        }
    }

    $imageUrl = null;
    if ($imageRow) {
        $imageUrl = build_data_url($imageRow['mime'] ?? null, $imageRow['blob'] ?? null, $imageRow['url'] ?? null);
    }
    if (!$imageUrl && $imageKey && !empty($row[$imageKey])) {
        $imageUrl = (string) $row[$imageKey];
    }

    return [
        'Id' => $id,
        'Codigo' => $codeKey && isset($row[$codeKey]) ? (string) $row[$codeKey] : null,
        'Nombre' => $nameKey && isset($row[$nameKey]) ? (string) $row[$nameKey] : null,
        'Precio' => $price,
        'Stock' => $stock,
        'Activo' => $active,
        'Categoria' => $categoryKey && isset($row[$categoryKey]) ? (string) $row[$categoryKey] : null,
        'Material' => $materialKey && isset($row[$materialKey]) ? (string) $row[$materialKey] : null,
        'ImagenUrl' => $imageUrl,
        'Descripcion' => $descriptionKey && isset($row[$descriptionKey]) ? (string) $row[$descriptionKey] : null,
    ];
}

function fetch_product_row(PDO $pdo, array $productSchema, array $imageSchema, int $id): ?array
{
    $columns = ['p.' . $productSchema['id'] . ' AS __id'];
    foreach (['code', 'name', 'price', 'stock', 'active', 'category', 'material', 'image', 'description'] as $key) {
        if (!empty($productSchema[$key])) {
            $columns[] = 'p.' . $productSchema[$key] . ' AS ' . $productSchema[$key];
        }
    }

    $sql = 'SELECT ' . implode(', ', $columns) . ' FROM ' . $productSchema['table'] . ' p WHERE p.' . $productSchema['id'] . ' = :id LIMIT 1';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();
    if (!$row) {
        return null;
    }

    $imageRow = null;
    if (!empty($imageSchema['table'])) {
        $sqlImg = 'SELECT ' . $imageSchema['id'] . ' AS imagen_id, ' . $imageSchema['url'] . ' AS url, ' . $imageSchema['blob'] . ' AS blob, ' . $imageSchema['mime'] . ' AS mime
                   FROM ' . $imageSchema['table'] . '
                   WHERE ' . $imageSchema['product_fk'] . ' = :id
                   ORDER BY ' . $imageSchema['id'] . ' ASC
                   LIMIT 1';
        $stmtImg = $pdo->prepare($sqlImg);
        $stmtImg->execute([':id' => $id]);
        $imageRow = $stmtImg->fetch();
    }

    $mapped = map_product_row($row, $productSchema, $imageRow ?: null);
    if ($imageRow && isset($imageRow['imagen_id'])) {
        $mapped['ImagenId'] = (int) $imageRow['imagen_id'];
    }
    return $mapped;
}

function fetch_products(PDO $pdo, array $productSchema, array $imageSchema): array
{
    $columns = ['p.' . $productSchema['id'] . ' AS __id'];
    foreach (['code', 'name', 'price', 'stock', 'active', 'category', 'material', 'image', 'description'] as $key) {
        if (!empty($productSchema[$key])) {
            $columns[] = 'p.' . $productSchema[$key] . ' AS ' . $productSchema[$key];
        }
    }

    $sql = 'SELECT ' . implode(', ', $columns) . ' FROM ' . $productSchema['table'] . ' p ORDER BY p.' . $productSchema['id'] . ' DESC';
    $rows = $pdo->query($sql)->fetchAll();
    if (!$rows) {
        return [];
    }

    $imageMap = [];
    if (!empty($imageSchema['table'])) {
        $ids = array_column($rows, '__id');
        $placeholders = [];
        $params = [];
        foreach ($ids as $index => $value) {
            $ph = ':id' . $index;
            $placeholders[] = $ph;
            $params[$ph] = $value;
        }
        $sqlImg = 'SELECT ' . $imageSchema['product_fk'] . ' AS product_id, ' . $imageSchema['id'] . ' AS imagen_id, ' . $imageSchema['url'] . ' AS url, ' . $imageSchema['blob'] . ' AS blob, ' . $imageSchema['mime'] . ' AS mime
                   FROM ' . $imageSchema['table'];
        if ($placeholders) {
            $sqlImg .= ' WHERE ' . $imageSchema['product_fk'] . ' IN (' . implode(', ', $placeholders) . ')';
        }
        $sqlImg .= ' ORDER BY ' . $imageSchema['id'] . ' ASC';
        $stmtImg = $pdo->prepare($sqlImg);
        $stmtImg->execute($params);
        while ($img = $stmtImg->fetch()) {
            $pid = (int) $img['product_id'];
            if (!isset($imageMap[$pid])) {
                $imageMap[$pid] = $img;
            }
        }
    }

    $products = [];
    foreach ($rows as $row) {
        $id = isset($row['__id']) ? (int) $row['__id'] : null;
        $mapped = map_product_row($row, $productSchema, $id && isset($imageMap[$id]) ? $imageMap[$id] : null);
        if ($id && isset($imageMap[$id]['imagen_id'])) {
            $mapped['ImagenId'] = (int) $imageMap[$id]['imagen_id'];
        }
        $products[] = $mapped;
    }

    return $products;
}

function extract_field(array $payload, array $keys, $default = null)
{
    foreach ($keys as $key) {
        if (array_key_exists($key, $payload)) {
            return $payload[$key];
        }
    }
    return $default;
}

function normalize_string($value): ?string
{
    if ($value === null) {
        return null;
    }
    $text = trim((string) $value);
    return $text === '' ? null : $text;
}

function normalize_numeric($value, bool $allowNull = true): ?float
{
    if ($value === null || $value === '') {
        return $allowNull ? null : 0.0;
    }
    if (is_numeric($value)) {
        return (float) $value;
    }
    $filtered = preg_replace('/[^0-9.\-]/', '', (string) $value);
    if ($filtered === '' || !is_numeric($filtered)) {
        return $allowNull ? null : 0.0;
    }
    return (float) $filtered;
}

function normalize_int($value, bool $allowNull = true): ?int
{
    if ($value === null || $value === '') {
        return $allowNull ? null : 0;
    }
    if (is_numeric($value)) {
        return (int) $value;
    }
    $filtered = preg_replace('/[^0-9\-]/', '', (string) $value);
    if ($filtered === '' || !is_numeric($filtered)) {
        return $allowNull ? null : 0;
    }
    return (int) $filtered;
}

function normalize_bool_flag($value): int
{
    if ($value === null) {
        return 0;
    }
    if (is_bool($value)) {
        return $value ? 1 : 0;
    }
    if (is_numeric($value)) {
        return (int) $value ? 1 : 0;
    }
    $text = strtolower(trim((string) $value));
    return in_array($text, ['1', 'true', 'activo', 'habilitado', 'disponible', 'yes', 'si', 'on'], true) ? 1 : 0;
}
