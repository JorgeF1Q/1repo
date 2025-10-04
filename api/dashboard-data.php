<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require __DIR__ . '/db.php';

/* Respuesta: rows[] con
   segment, country, product, unitsSold, salePrice, grossSales, discounts,
   sales, cogs, profit, date, monthNumber, monthName, year, discountBand
*/

$dateExpr            = "o.fecha";      // cambia si tu columna de fecha es otra
$orderStatusFilter   = "";             // ej: "AND o.estado IN ('pagada','completada')"
$defaultCountry      = "Guatemala";
$useProductCostField = false;          // pon true si tienes p.costo

$from = $_GET['from'] ?? null;
$to   = $_GET['to']   ?? null;

$where = [];
$params = [];
if ($from) { $where[] = "$dateExpr >= :from"; $params[':from'] = $from; }
if ($to)   { $where[] = "$dateExpr < DATE_ADD(:to, INTERVAL 1 DAY)"; $params[':to'] = $to; }
$whereSql = $where ? "WHERE " . implode(" AND ", $where) : "";

function tableExists(PDO $pdo, $table) {
  $stmt = $pdo->prepare("
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = :table
  ");
  $stmt->execute([':table' => $table]);
  return (int)$stmt->fetchColumn() > 0;
}

function columnExists(PDO $pdo, $table, $column) {
  $stmt = $pdo->prepare("
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = :table
      AND COLUMN_NAME = :column
  ");
  $stmt->execute([':table' => $table, ':column' => $column]);
  return (int)$stmt->fetchColumn() > 0;
}

/* ---------- util ---------- */
function bandFromPct($pct){
  if ($pct >= 30) return '30%+';
  if ($pct >= 20) return '20–29%';
  if ($pct >= 10) return '10–19%';
  if ($pct >  0)  return '1–9%';
  return '0%';
}

try {
  /* -------- Detecta columnas/tablas opcionales -------- */
  $hasCuponId = false;
  $hasCategoria = false;

  $customerIdExpr   = "NULL";
  $customerNameExpr = "CONCAT('Cliente #', o.orden_id)";
  $joinCliente      = "";

  if (columnExists($pdo, 'orden', 'nombre_cliente')) {
    $customerNameExpr = "COALESCE(NULLIF(o.nombre_cliente,''), {$customerNameExpr})";
  }
  if (columnExists($pdo, 'orden', 'correo_cliente')) {
    $customerNameExpr = "COALESCE(NULLIF(o.nombre_cliente,''), NULLIF(o.correo_cliente,''), {$customerNameExpr})";
  }

  if (columnExists($pdo, 'orden', 'cliente_id')) {
    $customerIdExpr = "o.cliente_id";
    $clienteTable = null;
    if (tableExists($pdo, 'cliente')) {
      $clienteTable = 'cliente';
    } elseif (tableExists($pdo, 'clientes')) {
      $clienteTable = 'clientes';
    }

    if ($clienteTable) {
      $clientePk = 'cliente_id';
      if (!columnExists($pdo, $clienteTable, $clientePk)) {
        if (columnExists($pdo, $clienteTable, 'id')) {
          $clientePk = 'id';
        } elseif (columnExists($pdo, $clienteTable, 'usuario_id')) {
          $clientePk = 'usuario_id';
        } else {
          $clientePk = null;
        }
      }

      if ($clientePk) {
        $joinCliente = "LEFT JOIN {$clienteTable} cli ON cli.{$clientePk} = o.cliente_id";

        $nameParts = [];
        if (columnExists($pdo, $clienteTable, 'nombre')) {
          $nameParts[] = "NULLIF(cli.nombre,'')";
        }
        if (columnExists($pdo, $clienteTable, 'nombres')) {
          $nameParts[] = "NULLIF(cli.nombres,'')";
        }
        if (columnExists($pdo, $clienteTable, 'apellidos')) {
          $nameParts[] = "NULLIF(cli.apellidos,'')";
        }
        if (columnExists($pdo, $clienteTable, 'apellido')) {
          $nameParts[] = "NULLIF(cli.apellido,'')";
        }

        $customerOptions = [];
        if ($nameParts) {
          $customerOptions[] = "NULLIF(CONCAT_WS(' ', " . implode(', ', $nameParts) . "), '')";
        }
        if (columnExists($pdo, $clienteTable, 'nombre_completo')) {
          $customerOptions[] = "NULLIF(cli.nombre_completo,'')";
        }
        if (columnExists($pdo, $clienteTable, 'razon_social')) {
          $customerOptions[] = "NULLIF(cli.razon_social,'')";
        }
        if (columnExists($pdo, $clienteTable, 'email')) {
          $customerOptions[] = "NULLIF(cli.email,'')";
        }
        if (columnExists($pdo, $clienteTable, 'correo')) {
          $customerOptions[] = "NULLIF(cli.correo,'')";
        }

        $customerOptions[] = $customerNameExpr;
        $customerNameExpr = 'COALESCE(' . implode(', ', array_unique($customerOptions)) . ')';
      }
    }
  }

  $orderStatusExpr = "NULL";
  if (columnExists($pdo, 'orden', 'estado')) {
    $orderStatusExpr = "o.estado";
  } elseif (columnExists($pdo, 'orden', 'status')) {
    $orderStatusExpr = "o.status";
  } elseif (columnExists($pdo, 'orden', 'estatus')) {
    $orderStatusExpr = "o.estatus";
  }

  // cupon_id en tabla orden
  $q = $pdo->prepare("
    SELECT COUNT(*) AS n
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orden'
      AND COLUMN_NAME = 'cupon_id'
  ");
  $q->execute();
  $hasCuponId = (int)$q->fetchColumn() > 0;

  // tabla categoria existe
  $q = $pdo->prepare("
    SELECT COUNT(*) AS n
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'categoria'
  ");
  $q->execute();
  $hasCategoria = (int)$q->fetchColumn() > 0;

  /* -------- 1) Líneas de detalle -------- */
  $segmentExpr = $hasCategoria
    ? "COALESCE(cat.nombre,'General')"
    : "'General'";

  $joinCategoria = $hasCategoria ? "LEFT JOIN categoria cat ON cat.categoria_id = p.categoria_id" : "";

  $sqlBase = "
    SELECT
      o.orden_id,
      DATE($dateExpr)          AS d,
      MONTH($dateExpr)         AS monthNumber,
      MONTHNAME($dateExpr)     AS monthName,
      YEAR($dateExpr)          AS year,

      od.cantidad              AS unitsSold,
      od.precio_unitario       AS salePrice,
      (od.cantidad * od.precio_unitario) AS grossLine,

      p.producto_id,
      p.nombre                 AS product,
      $segmentExpr             AS segment,
      :country                 AS country,
      {$customerIdExpr}        AS customerId,
      {$customerNameExpr}      AS customerName,
      {$orderStatusExpr}       AS orderStatus
      " . ($useProductCostField ? ", COALESCE(p.costo,0) AS unitCost" : ", 0 AS unitCost") . "
    FROM orden o
    JOIN orden_detalle od ON od.orden_id   = o.orden_id
    JOIN producto      p  ON p.producto_id = od.producto_id
    $joinCategoria
    $joinCliente
    $whereSql
    $orderStatusFilter
  ";
  $stmt = $pdo->prepare($sqlBase);
  $stmt->bindValue(':country', $defaultCountry);
  foreach ($params as $k=>$v) $stmt->bindValue($k,$v);
  $stmt->execute();
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  /* -------- 2) Bruto total por orden (para prorrateo) -------- */
  $sqlGross = "
    SELECT o.orden_id, SUM(od.cantidad * od.precio_unitario) AS grossTotal
    FROM orden o
    JOIN orden_detalle od ON od.orden_id = o.orden_id
    $whereSql
    $orderStatusFilter
    GROUP BY o.orden_id
  ";
  $stmt2 = $pdo->prepare($sqlGross);
  foreach ($params as $k=>$v) $stmt2->bindValue($k,$v);
  $stmt2->execute();
  $grossByOrder = [];
  foreach ($stmt2 as $g) $grossByOrder[$g['orden_id']] = (float)$g['grossTotal'];

  /* -------- 3) Descuento total por orden (si hay cupon_id) -------- */
  $discByOrder = [];
  if ($hasCuponId) {
    // usamos un subselect de bruto para evaluar porcentaje/monto y mins
    $sqlDisc = "
      WITH gr AS (
        SELECT o.orden_id, SUM(od.cantidad * od.precio_unitario) AS gross
        FROM orden o
        JOIN orden_detalle od ON od.orden_id=o.orden_id
        $whereSql
        $orderStatusFilter
        GROUP BY o.orden_id
      )
      SELECT o.orden_id,
             CASE
               WHEN c.id IS NULL OR c.Activo <> 1 OR gr.gross < IFNULL(c.MinSubtotal,0)
                 THEN 0
               WHEN LOWER(c.tipo)='porcentaje'
                 THEN gr.gross * (c.valor/100)
               WHEN LOWER(c.tipo)='monto'
                 THEN c.valor
               ELSE 0
             END AS orderDisc
      FROM orden o
      JOIN gr ON gr.orden_id = o.orden_id
      LEFT JOIN cupon c ON c.id = o.cupon_id
    ";
    $stmt3 = $pdo->prepare($sqlDisc);
    foreach ($params as $k=>$v) $stmt3->bindValue($k,$v);
    $stmt3->execute();
    foreach ($stmt3 as $r) $discByOrder[$r['orden_id']] = (float)$r['orderDisc'];
  }

  /* -------- 4) Normalización + cálculo -------- */
  $out = [];
  foreach ($rows as $r) {
    $orderId   = (int)$r['orden_id'];
    $grossLine = (float)$r['grossLine'];
    $grossTot  = isset($grossByOrder[$orderId]) ? max(0.01,(float)$grossByOrder[$orderId]) : 0.01;

    $orderDisc = $discByOrder[$orderId] ?? 0.0;
    $discountLine = $orderDisc > 0 ? ($grossLine / $grossTot) * $orderDisc : 0.0;

    $sales  = max(0.0, $grossLine - $discountLine);
    $cogs   = ((float)$r['unitCost']) * ((float)$r['unitsSold']);
    $profit = $sales - $cogs;

    $discPct = ($grossLine > 0) ? ($discountLine / $grossLine * 100.0) : 0.0;

    $customerIdRaw = $r['customerId'] ?? null;
    $customerIdOut = null;
    if ($customerIdRaw !== null && $customerIdRaw !== '') {
      $customerIdOut = is_numeric($customerIdRaw) ? (int)$customerIdRaw : (string)$customerIdRaw;
    }

    $customerNameOut = isset($r['customerName']) ? trim((string)$r['customerName']) : null;
    if ($customerNameOut === '') {
      $customerNameOut = null;
    }

    $orderStatusOut = isset($r['orderStatus']) ? trim((string)$r['orderStatus']) : null;
    if ($orderStatusOut === '') {
      $orderStatusOut = null;
    }

    $out[] = [
      'orderId'      => $orderId,
      'customerId'   => $customerIdOut,
      'customerName' => $customerNameOut,
      'orderStatus'  => $orderStatusOut,
      'segment'      => $r['segment'] ?? 'General',
      'country'      => $r['country'] ?? $defaultCountry,
      'product'      => $r['product'],

      'unitsSold'    => (float)$r['unitsSold'],
      'salePrice'    => (float)$r['salePrice'],
      'grossSales'   => round($grossLine, 2),
      'discounts'    => round($discountLine, 2),
      'sales'        => round($sales, 2),
      'cogs'         => round($cogs, 2),
      'profit'       => round($profit, 2),

      'discountBand' => bandFromPct($discPct),

      'date'         => $r['d'],
      'monthNumber'  => (int)$r['monthNumber'],
      'monthName'    => $r['monthName'],
      'year'         => (int)$r['year'],
    ];
  }

  header('Content-Type: application/json; charset=UTF-8');
  echo json_encode(['rows'=>$out], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  http_response_code(500);
  header('Content-Type: application/json; charset=UTF-8');
  echo json_encode(['error'=>true,'message'=>$e->getMessage()], JSON_UNESCAPED_UNICODE);
}
