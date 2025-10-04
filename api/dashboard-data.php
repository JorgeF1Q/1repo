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
      :country                 AS country
      " . ($useProductCostField ? ", COALESCE(p.costo,0) AS unitCost" : ", 0 AS unitCost") . "
    FROM orden o
    JOIN orden_detalle od ON od.orden_id   = o.orden_id
    JOIN producto      p  ON p.producto_id = od.producto_id
    $joinCategoria
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

    $out[] = [
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
