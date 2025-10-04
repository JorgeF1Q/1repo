// /public_html/api/login.php
<?php
require __DIR__.'/db.php';
header('Content-Type: application/json; charset=UTF-8');

$input = json_decode(file_get_contents('php://input'), true);
$email = trim($input['email'] ?? '');
$password = $input['password'] ?? '';

if ($email === '' || $password === '') {
  http_response_code(400);
  echo json_encode(['ok'=>false,'error'=>'Faltan credenciales']);
  exit;
}

$stmt = $pdo->prepare("SELECT usuario_id, nombre, email, password_hash, rol_id, estado 
                       FROM usuario WHERE email = ? LIMIT 1");
$stmt->execute([$email]);
$u = $stmt->fetch();

if (!$u || (int)$u['estado'] !== 1) {
  http_response_code(401);
  echo json_encode(['ok'=>false,'error'=>'Usuario inactivo o no existe']);
  exit;
}

// permite hash o texto plano (para tu demo)
$passOk = password_verify($password, $u['password_hash']) || ($password === $u['password_hash']);
if (!$passOk) {
  http_response_code(401);
  echo json_encode(['ok'=>false,'error'=>'Credenciales inválidas']);
  exit;
}

// mapea rol_id -> role
$role = 'cliente';
switch ((int)$u['rol_id']) {
  case 4: $role = 'admin'; break;
  case 2: $role = 'ventas'; break;
  case 3: $role = 'cliente_premium'; break;
  // etc. según tu diseño
}

// token simple (si quieres algo más fuerte, crea tabla sesiones)
$token = bin2hex(random_bytes(16));

echo json_encode([
  'ok' => true,
  'token' => $token,
  'user' => [
    'id'     => (int)$u['usuario_id'],
    'nombre' => $u['nombre'],
    'email'  => $u['email'],
    'role'   => $role,
  ]
]);
