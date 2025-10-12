<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PATCH, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');
header('Vary: Origin');

require __DIR__ . '/db.php';

const ALLOWED_ORDER_STATUSES = ['pendiente', 'enviado', 'pagado', 'cancelado'];

function respondJson(int $status, array $payload = []): void
{
    http_response_code($status);
    if ($status === 204) {
        exit;
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function respondError(int $status, string $message, array $extra = []): void
{
    $payload = array_merge(['error' => $message], $extra);
    respondJson($status, $payload);
}

function readJsonInput(): array
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

function tableExists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table'
    );
    $stmt->execute([':table' => $table]);
    return (int) $stmt->fetchColumn() > 0;
}

function columnExists(PDO $pdo, string $table, string $column): bool
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

function detectTable(PDO $pdo, array $candidates): ?string
{
    foreach ($candidates as $candidate) {
        if (tableExists($pdo, $candidate)) {
            return $candidate;
        }
    }
    return null;
}

function detectColumn(PDO $pdo, string $table, array $candidates): ?string
{
    foreach ($candidates as $candidate) {
        if (columnExists($pdo, $table, $candidate)) {
            return $candidate;
        }
    }
    return null;
}

function ensureDeliveryTable(PDO $pdo, string $orderTable, string $orderPk): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS orden_entrega (
            orden_id INT NOT NULL,
            estado VARCHAR(20) NOT NULL DEFAULT "pendiente",
            repartidor_id INT NULL,
            repartidor_nombre VARCHAR(120) NULL,
            repartidor_contacto VARCHAR(120) NULL,
            notas TEXT NULL,
            pago_confirmado TINYINT(1) NOT NULL DEFAULT 0,
            fecha_asignacion DATETIME NULL,
            fecha_envio DATETIME NULL,
            fecha_pago DATETIME NULL,
            fecha_cancelacion DATETIME NULL,
            actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            actualizado_por INT NULL,
            PRIMARY KEY (orden_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    if (!columnExists($pdo, 'orden_entrega', 'repartidor_contacto')) {
        $pdo->exec('ALTER TABLE orden_entrega ADD COLUMN repartidor_contacto VARCHAR(120) NULL AFTER repartidor_nombre');
    }
    if (!columnExists($pdo, 'orden_entrega', 'notas')) {
        $pdo->exec('ALTER TABLE orden_entrega ADD COLUMN notas TEXT NULL AFTER repartidor_contacto');
    }
    if (!columnExists($pdo, 'orden_entrega', 'pago_confirmado')) {
        $pdo->exec('ALTER TABLE orden_entrega ADD COLUMN pago_confirmado TINYINT(1) NOT NULL DEFAULT 0 AFTER notas');
    }
    foreach (['fecha_asignacion', 'fecha_envio', 'fecha_pago', 'fecha_cancelacion'] as $column) {
        if (!columnExists($pdo, 'orden_entrega', $column)) {
            $pdo->exec("ALTER TABLE orden_entrega ADD COLUMN {$column} DATETIME NULL AFTER pago_confirmado");
        }
    }
    if (!columnExists($pdo, 'orden_entrega', 'actualizado_en')) {
        $pdo->exec(
            'ALTER TABLE orden_entrega ADD COLUMN actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER fecha_cancelacion'
        );
    }
    if (!columnExists($pdo, 'orden_entrega', 'actualizado_por')) {
        $pdo->exec('ALTER TABLE orden_entrega ADD COLUMN actualizado_por INT NULL AFTER actualizado_en');
    }

    $stmt = $pdo->prepare(
        "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'orden_entrega'
           AND REFERENCED_TABLE_NAME = :refTable"
    );
    $stmt->execute([':refTable' => $orderTable]);
    $hasForeignKey = (bool) $stmt->fetchColumn();

    if (!$hasForeignKey) {
        try {
            $constraint = 'fk_orden_entrega_' . preg_replace('/[^a-z0-9_]/i', '', $orderTable);
            $pdo->exec(
                sprintf(
                    'ALTER TABLE orden_entrega
                     ADD CONSTRAINT %s
                     FOREIGN KEY (orden_id) REFERENCES %s(%s)
                     ON DELETE CASCADE ON UPDATE CASCADE',
                    $constraint,
                    $orderTable,
                    $orderPk
                )
            );
        } catch (Throwable $e) {
            // Ignorar si ya existe con otro nombre o no se puede crear la relación.
        }
    }
}

function normalizeStatus(?string $status): string
{
    $status = $status === null ? '' : trim(mb_strtolower($status));
    if ($status === '') {
        return 'pendiente';
    }
    $map = [
        'pending' => 'pendiente',
        'procesando' => 'pendiente',
        'processing' => 'pendiente',
        'nuevo' => 'pendiente',
        'new' => 'pendiente',
        'enviada' => 'enviado',
        'despachado' => 'enviado',
        'despachada' => 'enviado',
        'shipped' => 'enviado',
        'delivery' => 'enviado',
        'pagada' => 'pagado',
        'paid' => 'pagado',
        'completado' => 'pagado',
        'completada' => 'pagado',
        'completed' => 'pagado',
        'cancelada' => 'cancelado',
        'cancelled' => 'cancelado',
        'anulado' => 'cancelado',
        'anulada' => 'cancelado',
        'void' => 'cancelado',
    ];
    return $map[$status] ?? $status;
}

function statusLabel(string $status): string
{
    return match ($status) {
        'pendiente' => 'Pendiente',
        'enviado' => 'Enviado',
        'pagado' => 'Pagado',
        'cancelado' => 'Cancelado',
        default => ucfirst($status),
    };
}

function detectOrdersSchema(PDO $pdo): array
{
    $orderTable = detectTable($pdo, ['orden', 'ordenes', 'pedido', 'pedidos', 'venta', 'ventas', 'orders', 'order']);
    if (!$orderTable) {
        throw new RuntimeException('No se encontró la tabla de órdenes en la base de datos.');
    }

    $orderId = detectColumn($pdo, $orderTable, ['orden_id', 'id', 'pedido_id', 'venta_id', 'order_id']);
    if (!$orderId) {
        throw new RuntimeException('No se encontró la columna identificadora de la orden.');
    }

    $schema = [
        'order_table' => $orderTable,
        'order_id' => $orderId,
        'order_code' => detectColumn($pdo, $orderTable, ['codigo', 'codigo_orden', 'numero', 'numero_orden', 'order_number', 'referencia']),
        'order_status' => detectColumn($pdo, $orderTable, ['estado', 'estatus', 'status']),
        'order_total' => detectColumn($pdo, $orderTable, ['total', 'total_pedido', 'monto_total', 'total_final', 'gran_total']),
        'order_payment_method' => detectColumn($pdo, $orderTable, ['metodo_pago', 'forma_pago', 'payment_method', 'metodo', 'metodo_de_pago']),
        'order_payment_reference' => detectColumn($pdo, $orderTable, ['referencia_pago', 'referencia', 'no_transaccion', 'numero_referencia', 'transaccion']),
        'order_coupon' => detectColumn($pdo, $orderTable, ['cupon_codigo', 'cupon', 'coupon_code', 'codigo_descuento']),
        'order_customer_name' => detectColumn($pdo, $orderTable, ['nombre_cliente', 'cliente', 'cliente_nombre', 'customer_name', 'customer']),
        'order_customer_email' => detectColumn($pdo, $orderTable, ['correo_cliente', 'email_cliente', 'email', 'correo', 'customer_email']),
        'order_customer_phone' => detectColumn($pdo, $orderTable, ['telefono_cliente', 'telefono', 'telefono_contacto', 'phone', 'customer_phone']),
        'order_customer_address' => detectColumn($pdo, $orderTable, ['direccion_envio', 'direccion', 'direccion_entrega', 'shipping_address', 'address']),
        'order_created_at' => detectColumn($pdo, $orderTable, ['fecha', 'fecha_creacion', 'fecha_registro', 'created_at', 'creado_en']),
        'order_updated_at' => detectColumn($pdo, $orderTable, ['updated_at', 'fecha_actualizacion', 'actualizado_en', 'fecha_modificacion']),
    ];

    $detailTable = detectTable($pdo, ['orden_detalle', 'orden_detalles', 'detalle_orden', 'detalles_orden', 'order_items', 'pedido_detalle', 'detalle_pedido', 'venta_detalle', 'detalle_venta']);
    $schema['detail_table'] = $detailTable;
    if ($detailTable) {
        $schema['detail_order_fk'] = detectColumn($pdo, $detailTable, ['orden_id', 'order_id', 'pedido_id', 'venta_id']);
        $schema['detail_product_fk'] = detectColumn($pdo, $detailTable, ['producto_id', 'product_id', 'articulo_id', 'item_id']);
        $schema['detail_quantity'] = detectColumn($pdo, $detailTable, ['cantidad', 'qty', 'quantity', 'unidades', 'units']);
        $schema['detail_unit_price'] = detectColumn($pdo, $detailTable, ['precio_unitario', 'precio', 'price', 'unit_price', 'valor_unitario']);
        $schema['detail_total_line'] = detectColumn($pdo, $detailTable, ['total_linea', 'total_line', 'subtotal', 'monto']);
    } else {
        $schema['detail_order_fk'] = $schema['detail_product_fk'] = $schema['detail_quantity'] = $schema['detail_unit_price'] = $schema['detail_total_line'] = null;
    }

    $productTable = detectTable($pdo, ['producto', 'productos', 'articulo', 'articulos', 'product', 'products']);
    $schema['product_table'] = $productTable;
    if ($productTable) {
        $schema['product_id'] = detectColumn($pdo, $productTable, ['producto_id', 'id', 'articulo_id', 'product_id']);
        $schema['product_name'] = detectColumn($pdo, $productTable, ['nombre', 'descripcion', 'name', 'titulo']);
        $schema['product_stock'] = detectColumn($pdo, $productTable, ['stock', 'existencia', 'existencias', 'cantidad', 'cantidad_disponible']);
    } else {
        $schema['product_id'] = $schema['product_name'] = $schema['product_stock'] = null;
    }

    return $schema;
}

function sqlStatusExpression(array $schema): string
{
    $parts = ["NULLIF(oe.estado,'')"];
    if (!empty($schema['order_status'])) {
        $parts[] = "NULLIF(o." . $schema['order_status'] . ",'')";
    }
    $parts[] = "'pendiente'";
    return 'LOWER(COALESCE(' . implode(', ', $parts) . '))';
}

function formatDateValue(?string $value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }
    return substr($value, 0, 19);
}

function formatOrderRow(array $row): array
{
    $status = normalizeStatus($row['estado'] ?? $row['estado_gestion'] ?? '');
    if (!in_array($status, ALLOWED_ORDER_STATUSES, true)) {
        $status = normalizeStatus($status);
    }

    $total = null;
    if (isset($row['total'])) {
        $numeric = is_numeric($row['total']) ? (float) $row['total'] : null;
        if ($numeric !== null) {
            $total = $numeric;
        }
    }

    return [
        'id' => isset($row['id']) ? (int) $row['id'] : null,
        'code' => $row['codigo'] ?? null,
        'status' => $status,
        'status_label' => statusLabel($status),
        'total' => $total,
        'payment_method' => $row['metodo_pago'] ?? null,
        'payment_reference' => $row['referencia_pago'] ?? null,
        'coupon_code' => $row['cupon_codigo'] ?? null,
        'customer' => [
            'name' => $row['cliente'] ?? null,
            'email' => $row['cliente_email'] ?? null,
            'phone' => $row['cliente_telefono'] ?? null,
            'address' => $row['cliente_direccion'] ?? null,
        ],
        'delivery' => [
            'person' => [
                'id' => isset($row['repartidor_id']) ? (int) $row['repartidor_id'] : null,
                'name' => $row['repartidor_nombre'] ?? null,
                'contact' => $row['repartidor_contacto'] ?? null,
            ],
            'payment_confirmed' => (bool) ($row['pago_confirmado'] ?? false),
            'notes' => $row['notas'] ?? null,
            'assigned_at' => formatDateValue($row['fecha_asignacion'] ?? null),
            'shipped_at' => formatDateValue($row['fecha_envio'] ?? null),
            'paid_at' => formatDateValue($row['fecha_pago'] ?? null),
            'canceled_at' => formatDateValue($row['fecha_cancelacion'] ?? null),
            'updated_at' => formatDateValue($row['gestion_actualizado_en'] ?? null),
        ],
        'created_at' => formatDateValue($row['creado_en'] ?? null),
        'updated_at' => formatDateValue($row['actualizado_en'] ?? null),
    ];
}

function fetchOrdersList(PDO $pdo, array $schema, array $filters = []): array
{
    $statusExpr = sqlStatusExpression($schema);
    $select = [
        'o.' . $schema['order_id'] . ' AS id',
        $statusExpr . ' AS estado',
        'oe.estado AS estado_gestion',
        'oe.pago_confirmado AS pago_confirmado',
        'oe.repartidor_nombre',
        'oe.repartidor_contacto',
        'oe.repartidor_id',
        'oe.notas',
        'oe.fecha_asignacion',
        'oe.fecha_envio',
        'oe.fecha_pago',
        'oe.fecha_cancelacion',
        'oe.actualizado_en AS gestion_actualizado_en',
    ];

    if (!empty($schema['order_code'])) {
        $select[] = 'o.' . $schema['order_code'] . ' AS codigo';
    }
    if (!empty($schema['order_total'])) {
        $select[] = 'o.' . $schema['order_total'] . ' AS total';
    } else {
        $select[] = 'NULL AS total';
    }
    if (!empty($schema['order_payment_method'])) {
        $select[] = 'o.' . $schema['order_payment_method'] . ' AS metodo_pago';
    }
    if (!empty($schema['order_payment_reference'])) {
        $select[] = 'o.' . $schema['order_payment_reference'] . ' AS referencia_pago';
    }
    if (!empty($schema['order_coupon'])) {
        $select[] = 'o.' . $schema['order_coupon'] . ' AS cupon_codigo';
    }
    if (!empty($schema['order_customer_name'])) {
        $select[] = 'o.' . $schema['order_customer_name'] . ' AS cliente';
    }
    if (!empty($schema['order_customer_email'])) {
        $select[] = 'o.' . $schema['order_customer_email'] . ' AS cliente_email';
    }
    if (!empty($schema['order_customer_phone'])) {
        $select[] = 'o.' . $schema['order_customer_phone'] . ' AS cliente_telefono';
    }
    if (!empty($schema['order_customer_address'])) {
        $select[] = 'o.' . $schema['order_customer_address'] . ' AS cliente_direccion';
    }
    if (!empty($schema['order_created_at'])) {
        $select[] = 'o.' . $schema['order_created_at'] . ' AS creado_en';
    } else {
        $select[] = 'NULL AS creado_en';
    }
    if (!empty($schema['order_updated_at'])) {
        $select[] = 'o.' . $schema['order_updated_at'] . ' AS actualizado_en';
    } else {
        $select[] = 'NULL AS actualizado_en';
    }

    $sql = 'SELECT ' . implode("
       ", $select) . "
"
         . 'FROM ' . $schema['order_table'] . ' o
'
         . 'LEFT JOIN orden_entrega oe ON oe.orden_id = o.' . $schema['order_id'] . "
";

    $where = [];
    $params = [];

    if (!empty($filters['statuses']) && is_array($filters['statuses'])) {
        $statuses = array_values(array_filter(array_map('normalizeStatus', $filters['statuses'])));
        if ($statuses) {
            $placeholders = [];
            foreach ($statuses as $i => $value) {
                $ph = ':status' . $i;
                $placeholders[] = $ph;
                $params[$ph] = $value;
            }
            $where[] = $statusExpr . ' IN (' . implode(', ', $placeholders) . ')';
        }
    }

    $search = trim((string) ($filters['search'] ?? ''));
    if ($search !== '') {
        $like = '%' . $search . '%';
        $conditions = [];
        if (!empty($schema['order_code'])) {
            $conditions[] = 'o.' . $schema['order_code'] . ' LIKE :search';
        }
        if (!empty($schema['order_customer_name'])) {
            $conditions[] = 'o.' . $schema['order_customer_name'] . ' LIKE :search';
        }
        if (!empty($schema['order_customer_phone'])) {
            $conditions[] = 'o.' . $schema['order_customer_phone'] . ' LIKE :search';
        }
        if (!empty($schema['order_customer_address'])) {
            $conditions[] = 'o.' . $schema['order_customer_address'] . ' LIKE :search';
        }
        $conditions[] = 'oe.repartidor_nombre LIKE :search';
        if ($conditions) {
            $where[] = '(' . implode(' OR ', $conditions) . ')';
            $params[':search'] = $like;
        }
    }

    if ($where) {
        $sql .= 'WHERE ' . implode(' AND ', $where) . "
";
    }

    $orderBy = !empty($schema['order_updated_at']) ? 'o.' . $schema['order_updated_at']
        : (!empty($schema['order_created_at']) ? 'o.' . $schema['order_created_at'] : 'o.' . $schema['order_id']);
    $sql .= 'ORDER BY ' . $orderBy . ' DESC
';

    $limit = isset($filters['limit']) ? (int) $filters['limit'] : 200;
    if ($limit > 0) {
        $sql .= 'LIMIT ' . min($limit, 500);
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    return array_map(static fn(array $row): array => formatOrderRow($row), $rows);
}

function fetchOrderRow(PDO $pdo, array $schema, int $id): ?array
{
    $statusExpr = sqlStatusExpression($schema);
    $select = [
        'o.' . $schema['order_id'] . ' AS id',
        $statusExpr . ' AS estado',
        'oe.estado AS estado_gestion',
        'oe.pago_confirmado AS pago_confirmado',
        'oe.repartidor_nombre',
        'oe.repartidor_contacto',
        'oe.repartidor_id',
        'oe.notas',
        'oe.fecha_asignacion',
        'oe.fecha_envio',
        'oe.fecha_pago',
        'oe.fecha_cancelacion',
        'oe.actualizado_en AS gestion_actualizado_en',
    ];

    if (!empty($schema['order_code'])) {
        $select[] = 'o.' . $schema['order_code'] . ' AS codigo';
    }
    if (!empty($schema['order_total'])) {
        $select[] = 'o.' . $schema['order_total'] . ' AS total';
    }
    if (!empty($schema['order_payment_method'])) {
        $select[] = 'o.' . $schema['order_payment_method'] . ' AS metodo_pago';
    }
    if (!empty($schema['order_payment_reference'])) {
        $select[] = 'o.' . $schema['order_payment_reference'] . ' AS referencia_pago';
    }
    if (!empty($schema['order_coupon'])) {
        $select[] = 'o.' . $schema['order_coupon'] . ' AS cupon_codigo';
    }
    if (!empty($schema['order_customer_name'])) {
        $select[] = 'o.' . $schema['order_customer_name'] . ' AS cliente';
    }
    if (!empty($schema['order_customer_email'])) {
        $select[] = 'o.' . $schema['order_customer_email'] . ' AS cliente_email';
    }
    if (!empty($schema['order_customer_phone'])) {
        $select[] = 'o.' . $schema['order_customer_phone'] . ' AS cliente_telefono';
    }
    if (!empty($schema['order_customer_address'])) {
        $select[] = 'o.' . $schema['order_customer_address'] . ' AS cliente_direccion';
    }
    if (!empty($schema['order_created_at'])) {
        $select[] = 'o.' . $schema['order_created_at'] . ' AS creado_en';
    }
    if (!empty($schema['order_updated_at'])) {
        $select[] = 'o.' . $schema['order_updated_at'] . ' AS actualizado_en';
    }

    $sql = 'SELECT ' . implode("
       ", $select) . "
"
         . 'FROM ' . $schema['order_table'] . ' o
'
         . 'LEFT JOIN orden_entrega oe ON oe.orden_id = o.' . $schema['order_id'] . "
"
         . 'WHERE o.' . $schema['order_id'] . ' = :id
'
         . 'LIMIT 1';

    $stmt = $pdo->prepare($sql);
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();
    if (!$row) {
        return null;
    }
    return formatOrderRow($row);
}

function fetchOrderItems(PDO $pdo, array $schema, int $orderId): array
{
    if (empty($schema['detail_table']) || empty($schema['detail_order_fk'])) {
        return [];
    }

    $columns = [
        'd.' . $schema['detail_product_fk'] . ' AS product_id',
    ];
    if (!empty($schema['detail_quantity'])) {
        $columns[] = 'd.' . $schema['detail_quantity'] . ' AS quantity';
    }
    if (!empty($schema['detail_unit_price'])) {
        $columns[] = 'd.' . $schema['detail_unit_price'] . ' AS unit_price';
    }
    if (!empty($schema['detail_total_line'])) {
        $columns[] = 'd.' . $schema['detail_total_line'] . ' AS line_total';
    }

    if (!empty($schema['product_table']) && !empty($schema['product_id']) && !empty($schema['product_name'])) {
        $columns[] = 'p.' . $schema['product_name'] . ' AS product_name';
        $join = 'LEFT JOIN ' . $schema['product_table'] . ' p ON p.' . $schema['product_id'] . ' = d.' . $schema['detail_product_fk'];
    } else {
        $columns[] = 'NULL AS product_name';
        $join = '';
    }

    $sql = 'SELECT ' . implode(', ', $columns) . "
"
         . 'FROM ' . $schema['detail_table'] . ' d
'
         . $join . "
"
         . 'WHERE d.' . $schema['detail_order_fk'] . ' = :id
'
         . 'ORDER BY d.' . $schema['detail_product_fk'];

    $stmt = $pdo->prepare($sql);
    $stmt->execute([':id' => $orderId]);
    $rows = $stmt->fetchAll();

    return array_map(static function (array $row): array {
        $quantity = isset($row['quantity']) && is_numeric($row['quantity']) ? (float) $row['quantity'] : null;
        $unitPrice = isset($row['unit_price']) && is_numeric($row['unit_price']) ? (float) $row['unit_price'] : null;
        $lineTotal = isset($row['line_total']) && is_numeric($row['line_total']) ? (float) $row['line_total'] : null;

        if ($lineTotal === null && $quantity !== null && $unitPrice !== null) {
            $lineTotal = $quantity * $unitPrice;
        }

        return [
            'product_id' => isset($row['product_id']) ? (int) $row['product_id'] : null,
            'product_name' => $row['product_name'] ?? null,
            'quantity' => $quantity,
            'unit_price' => $unitPrice,
            'line_total' => $lineTotal,
        ];
    }, $rows);
}

function restockOrderItems(PDO $pdo, array $schema, int $orderId): void
{
    if (empty($schema['detail_table']) || empty($schema['product_table']) || empty($schema['detail_product_fk']) || empty($schema['product_stock']) || empty($schema['detail_quantity'])) {
        return;
    }

    $sql = 'SELECT ' . $schema['detail_product_fk'] . ' AS product_id, ' . $schema['detail_quantity'] . ' AS quantity
            FROM ' . $schema['detail_table'] . '
            WHERE ' . $schema['detail_order_fk'] . ' = :id';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':id' => $orderId]);
    $items = $stmt->fetchAll();

    foreach ($items as $item) {
        if (!isset($item['product_id']) || !isset($item['quantity'])) {
            continue;
        }
        $qty = (float) $item['quantity'];
        if ($qty <= 0) {
            continue;
        }
        $update = $pdo->prepare(
            'UPDATE ' . $schema['product_table'] . '
             SET ' . $schema['product_stock'] . ' = ' . $schema['product_stock'] . ' + :qty
             WHERE ' . $schema['product_id'] . ' = :pid'
        );
        $update->execute([
            ':qty' => $qty,
            ':pid' => $item['product_id'],
        ]);
    }
}

function extractStatusesFromQuery($input): array
{
    $values = [];
    if (is_array($input)) {
        foreach ($input as $entry) {
            $values = array_merge($values, extractStatusesFromQuery($entry));
        }
        return array_values(array_unique($values));
    }
    if ($input === null || $input === '') {
        return [];
    }
    $parts = preg_split('/[|,]/', (string) $input);
    $statuses = [];
    foreach ($parts as $part) {
        $normalized = normalizeStatus($part);
        if ($normalized !== '' && !in_array($normalized, $statuses, true)) {
            $statuses[] = $normalized;
        }
    }
    return $statuses;
}

function updateOrder(PDO $pdo, array $schema, int $id, array $payload): array
{
    $order = fetchOrderRow($pdo, $schema, $id);
    if (!$order) {
        throw new RuntimeException('No se encontró la orden solicitada.');
    }

    $previousStatus = normalizeStatus($order['status']);
    if ($previousStatus === 'cancelado' && (!isset($payload['status']) || normalizeStatus($payload['status']) !== 'cancelado')) {
        throw new InvalidArgumentException('La orden cancelada no puede cambiarse a otro estado.');
    }

    $newStatus = array_key_exists('status', $payload) ? normalizeStatus((string) $payload['status']) : $previousStatus;
    if (!in_array($newStatus, ALLOWED_ORDER_STATUSES, true)) {
        throw new InvalidArgumentException('Estado de orden no válido.');
    }

    $deliveryName = isset($payload['delivery_person']) ? trim((string) $payload['delivery_person']) : ($order['delivery']['person']['name'] ?? '');
    $deliveryContact = isset($payload['delivery_contact']) ? trim((string) $payload['delivery_contact']) : ($order['delivery']['person']['contact'] ?? null);
    $deliveryId = isset($payload['delivery_person_id']) && $payload['delivery_person_id'] !== ''
        ? (int) $payload['delivery_person_id']
        : ($order['delivery']['person']['id'] ?? null);

    if ($newStatus === 'enviado' && $deliveryName === '') {
        throw new InvalidArgumentException('Debes asignar un repartidor antes de marcar la orden como enviada.');
    }

    $paymentConfirmed = array_key_exists('payment_confirmed', $payload)
        ? (bool) $payload['payment_confirmed']
        : (bool) ($order['delivery']['payment_confirmed'] ?? false);
    if ($newStatus === 'pagado') {
        $paymentConfirmed = true;
    }

    $notes = isset($payload['notes']) ? trim((string) $payload['notes']) : ($order['delivery']['notes'] ?? null);

    $previouslyPaid = (bool) ($order['delivery']['payment_confirmed'] ?? false);

    $now = (new DateTimeImmutable('now'))->format('Y-m-d H:i:s');

    $assignedAt = $order['delivery']['assigned_at'] ?? null;
    if ($deliveryName !== '') {
        if (!$assignedAt || $deliveryName !== ($order['delivery']['person']['name'] ?? null)) {
            $assignedAt = $now;
        }
    } else {
        $assignedAt = null;
    }

    $shippedAt = $order['delivery']['shipped_at'] ?? null;
    if ($newStatus === 'enviado' && $previousStatus !== 'enviado') {
        $shippedAt = $now;
    }

    $paidAt = $order['delivery']['paid_at'] ?? null;
    if (($newStatus === 'pagado' && $previousStatus !== 'pagado') || (!$previouslyPaid && $paymentConfirmed)) {
        $paidAt = $now;
    }

    $canceledAt = $order['delivery']['canceled_at'] ?? null;
    $shouldRestock = false;
    if ($newStatus === 'cancelado' && $previousStatus !== 'cancelado') {
        $canceledAt = $now;
        $shouldRestock = true;
    }

    $pdo->beginTransaction();
    try {
        if (!empty($schema['order_status'])) {
            $stmt = $pdo->prepare(
                'UPDATE ' . $schema['order_table'] . '
                 SET ' . $schema['order_status'] . ' = :status
                 WHERE ' . $schema['order_id'] . ' = :id'
            );
            $stmt->execute([
                ':status' => $newStatus,
                ':id' => $id,
            ]);
        }

        $insert = $pdo->prepare(
            'INSERT INTO orden_entrega (
                orden_id, estado, repartidor_id, repartidor_nombre, repartidor_contacto, notas, pago_confirmado,
                fecha_asignacion, fecha_envio, fecha_pago, fecha_cancelacion, actualizado_por
            ) VALUES (
                :orden_id, :estado, :repartidor_id, :repartidor_nombre, :repartidor_contacto, :notas, :pago_confirmado,
                :fecha_asignacion, :fecha_envio, :fecha_pago, :fecha_cancelacion, :actualizado_por
            )
            ON DUPLICATE KEY UPDATE
                estado = VALUES(estado),
                repartidor_id = VALUES(repartidor_id),
                repartidor_nombre = VALUES(repartidor_nombre),
                repartidor_contacto = VALUES(repartidor_contacto),
                notas = VALUES(notas),
                pago_confirmado = VALUES(pago_confirmado),
                fecha_asignacion = COALESCE(VALUES(fecha_asignacion), fecha_asignacion),
                fecha_envio = COALESCE(VALUES(fecha_envio), fecha_envio),
                fecha_pago = COALESCE(VALUES(fecha_pago), fecha_pago),
                fecha_cancelacion = COALESCE(VALUES(fecha_cancelacion), fecha_cancelacion),
                actualizado_por = VALUES(actualizado_por)'
        );
        $insert->execute([
            ':orden_id' => $id,
            ':estado' => $newStatus,
            ':repartidor_id' => $deliveryId,
            ':repartidor_nombre' => $deliveryName !== '' ? $deliveryName : null,
            ':repartidor_contacto' => $deliveryContact !== '' ? $deliveryContact : null,
            ':notas' => $notes !== '' ? $notes : null,
            ':pago_confirmado' => $paymentConfirmed ? 1 : 0,
            ':fecha_asignacion' => $assignedAt,
            ':fecha_envio' => $shippedAt,
            ':fecha_pago' => $paidAt,
            ':fecha_cancelacion' => $canceledAt,
            ':actualizado_por' => null,
        ]);

        if ($shouldRestock) {
            restockOrderItems($pdo, $schema, $id);
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    $updated = fetchOrderRow($pdo, $schema, $id);
    if (!$updated) {
        throw new RuntimeException('No se pudo recuperar la orden actualizada.');
    }
    return $updated;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    respondJson(204);
}

try {
    $schema = detectOrdersSchema($pdo);
    ensureDeliveryTable($pdo, $schema['order_table'], $schema['order_id']);
} catch (Throwable $e) {
    respondError(500, 'No se pudo preparar el servicio de órdenes.', ['detail' => $e->getMessage()]);
}

$id = isset($_GET['id']) ? (int) $_GET['id'] : null;

try {
    switch ($method) {
        case 'GET':
            if ($id) {
                $order = fetchOrderRow($pdo, $schema, $id);
                if (!$order) {
                    respondError(404, 'Orden no encontrada.');
                }
                $with = strtolower(trim((string) ($_GET['with'] ?? '')));
                $includeItems = false;
                if ($with !== '') {
                    $includeItems = in_array('items', array_map('trim', explode(',', $with)), true);
                }
                if (!$includeItems && isset($_GET['with_items'])) {
                    $includeItems = filter_var($_GET['with_items'], FILTER_VALIDATE_BOOLEAN);
                }
                if ($includeItems) {
                    $order['items'] = fetchOrderItems($pdo, $schema, $id);
                }
                respondJson(200, ['ok' => true, 'order' => $order]);
            }

            $statuses = extractStatusesFromQuery($_GET['status'] ?? []);
            $search = isset($_GET['q']) ? trim((string) $_GET['q']) : '';
            $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 200;
            $orders = fetchOrdersList($pdo, $schema, [
                'statuses' => $statuses,
                'search' => $search,
                'limit' => $limit,
            ]);
            respondJson(200, [
                'ok' => true,
                'count' => count($orders),
                'orders' => $orders,
            ]);

        case 'PATCH':
        case 'PUT':
            if (!$id) {
                respondError(400, 'Falta el identificador de la orden.');
            }
            $payload = readJsonInput();
            $order = updateOrder($pdo, $schema, $id, $payload);
            if (isset($_GET['with']) && strpos((string) $_GET['with'], 'items') !== false) {
                $order['items'] = fetchOrderItems($pdo, $schema, $id);
            }
            respondJson(200, ['ok' => true, 'order' => $order]);

        default:
            respondError(405, 'Método no permitido.');
    }
} catch (InvalidArgumentException $e) {
    respondError(422, $e->getMessage());
} catch (RuntimeException $e) {
    respondError(404, $e->getMessage());
} catch (Throwable $e) {
    respondError(500, 'Ocurrió un error al procesar la solicitud.', ['detail' => $e->getMessage()]);
}
