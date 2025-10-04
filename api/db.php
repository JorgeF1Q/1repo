<?php
// public_html/api/db.php
header('Content-Type: application/json; charset=utf-8');

$DB_HOST = 'localhost';
$DB_NAME = 'u309586614_joyeria';     // <- TU BD
$DB_USER = 'u309586614_joyeria_user';       // <- usuario MySQL de Hostinger
$DB_PASS = 'Admin#Joyeria2025';      // <- contraseña

try {
  $pdo = new PDO(
    "mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4",
    $DB_USER, $DB_PASS,
    [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]
  );
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['error'=>'DB connection failed','detail'=>$e->getMessage()]);
  exit;
}

function json_out($data, $code=200){
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
  exit;
}
