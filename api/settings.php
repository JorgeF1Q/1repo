<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require __DIR__ . '/db.php';

function respondJson(int $status, array $payload): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function respondSuccess(array $payload = []): void {
    respondJson(200, $payload);
}

function respondError(int $status, string $message): void {
    respondJson($status, ['error' => $message]);
}

function normalizeEntity(?string $value): string {
    if ($value === null) {
        return '';
    }
    $normalized = strtolower($value);
    $normalized = str_replace(['_', ' '], '-', $normalized);
    return $normalized;
}

function readJsonInput(): array {
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

function tableExists(PDO $pdo, string $table): bool {
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table'
    );
    $stmt->execute([':table' => $table]);
    return (int) $stmt->fetchColumn() > 0;
}

function columnExists(PDO $pdo, string $table, string $column): bool {
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column'
    );
    $stmt->execute([
        ':table' => $table,
        ':column' => $column,
    ]);
    return (int) $stmt->fetchColumn() > 0;
}

function detectTable(PDO $pdo, array $candidates): ?string {
    foreach ($candidates as $candidate) {
        if (tableExists($pdo, $candidate)) {
            return $candidate;
        }
    }
    return null;
}

function detectColumn(PDO $pdo, string $table, array $candidates): ?string {
    foreach ($candidates as $candidate) {
        if (columnExists($pdo, $table, $candidate)) {
            return $candidate;
        }
    }
    return null;
}

function q(string $identifier): string {
    return '`' . str_replace('`', '``', $identifier) . '`';
}

function col(string $alias, string $column): string {
    return ($alias ? $alias . '.' : '') . q($column);
}

function detectSchema(PDO $pdo): array {
    $schema = [
        'users' => [
            'table' => null,
            'id' => null,
            'name' => null,
            'email' => null,
            'phone' => null,
            'role' => null,
            'status' => null,
            'password' => null,
            'last_access' => null,
        ],
        'roles' => [
            'table' => null,
            'id' => null,
            'name' => null,
            'description' => null,
            'level' => null,
        ],
        'permissions' => [
            'table' => null,
            'id' => null,
            'code' => null,
            'category' => null,
            'description' => null,
        ],
        'role_permissions' => [
            'table' => null,
            'role' => null,
            'permission' => null,
        ],
        'audit' => [
            'table' => null,
            'id' => null,
            'entity' => null,
            'action' => null,
            'detail' => null,
            'user' => null,
            'timestamp' => null,
        ],
    ];

    $schema['users']['table'] = detectTable($pdo, ['usuario', 'usuarios', 'users', 'user', 'administrador', 'administradores']);
    if ($schema['users']['table']) {
        $userTable = $schema['users']['table'];
        $schema['users']['id'] = detectColumn($pdo, $userTable, ['usuario_id', 'id', 'user_id', 'uid']);
        $schema['users']['name'] = detectColumn($pdo, $userTable, ['nombre', 'name', 'nombres']);
        $schema['users']['email'] = detectColumn($pdo, $userTable, ['email', 'correo', 'correo_electronico', 'user_email']);
        $schema['users']['phone'] = detectColumn($pdo, $userTable, ['telefono', 'phone', 'telefono_contacto']);
        $schema['users']['role'] = detectColumn($pdo, $userTable, ['rol_id', 'role_id', 'rol', 'role', 'perfil_id']);
        $schema['users']['status'] = detectColumn($pdo, $userTable, ['estado', 'status', 'activo', 'estatus']);
        $schema['users']['password'] = detectColumn($pdo, $userTable, ['password_hash', 'password', 'clave']);
        $schema['users']['last_access'] = detectColumn($pdo, $userTable, ['ultimo_acceso', 'last_login_at', 'updated_at', 'fecha_acceso', 'last_access']);
    }

    $schema['roles']['table'] = detectTable($pdo, ['rol', 'roles', 'role']);
    if ($schema['roles']['table']) {
        $roleTable = $schema['roles']['table'];
        $schema['roles']['id'] = detectColumn($pdo, $roleTable, ['rol_id', 'id', 'role_id']);
        $schema['roles']['name'] = detectColumn($pdo, $roleTable, ['nombre', 'name']);
        $schema['roles']['description'] = detectColumn($pdo, $roleTable, ['descripcion', 'description', 'detalle']);
        $schema['roles']['level'] = detectColumn($pdo, $roleTable, ['nivel', 'priority', 'level']);
    }

    $schema['permissions']['table'] = detectTable($pdo, ['permiso', 'permisos', 'permission', 'permissions']);
    if ($schema['permissions']['table']) {
        $permissionTable = $schema['permissions']['table'];
        $schema['permissions']['id'] = detectColumn($pdo, $permissionTable, ['permiso_id', 'id', 'permission_id']);
        $schema['permissions']['code'] = detectColumn($pdo, $permissionTable, ['codigo', 'code', 'clave', 'nombre']);
        $schema['permissions']['category'] = detectColumn($pdo, $permissionTable, ['categoria', 'category', 'modulo']);
        $schema['permissions']['description'] = detectColumn($pdo, $permissionTable, ['descripcion', 'description', 'detalle']);
    }

    $schema['role_permissions']['table'] = detectTable($pdo, ['rol_permiso', 'roles_permisos', 'rol_permiso_rel', 'role_permission', 'role_permissions']);
    if ($schema['role_permissions']['table']) {
        $pivotTable = $schema['role_permissions']['table'];
        $schema['role_permissions']['role'] = detectColumn($pdo, $pivotTable, ['rol_id', 'role_id', 'id_rol']);
        $schema['role_permissions']['permission'] = detectColumn($pdo, $pivotTable, ['permiso_id', 'permission_id', 'id_permiso']);
    }

    $schema['audit']['table'] = detectTable($pdo, ['auditoria', 'auditorias', 'audit', 'audits', 'bitacora', 'logs', 'log_auditoria']);
    if ($schema['audit']['table']) {
        $auditTable = $schema['audit']['table'];
        $schema['audit']['id'] = detectColumn($pdo, $auditTable, ['auditoria_id', 'id', 'audit_id']);
        $schema['audit']['entity'] = detectColumn($pdo, $auditTable, ['entidad', 'tabla', 'entity', 'tabla_afectada']);
        $schema['audit']['action'] = detectColumn($pdo, $auditTable, ['accion', 'accion_realizada', 'action', 'evento']);
        $schema['audit']['detail'] = detectColumn($pdo, $auditTable, ['detalle', 'descripcion', 'description', 'detalle_accion']);
        $schema['audit']['user'] = detectColumn($pdo, $auditTable, ['usuario', 'usuario_id', 'user_email', 'usuario_email', 'correo_usuario']);
        $schema['audit']['timestamp'] = detectColumn($pdo, $auditTable, ['fecha', 'timestamp', 'created_at', 'fecha_evento', 'fecha_accion']);
    }

    return $schema;
}

function fetchUsers(PDO $pdo, array $schema): array {
    $userSchema = $schema['users'];
    if (!$userSchema['table'] || !$userSchema['id']) {
        throw new RuntimeException('No se encontró la tabla de usuarios.');
    }

    $select = [col('u', $userSchema['id']) . ' AS usuario_id'];
    $select[] = $userSchema['name'] ? col('u', $userSchema['name']) . ' AS nombre' : 'NULL AS nombre';
    $select[] = $userSchema['email'] ? col('u', $userSchema['email']) . ' AS email' : 'NULL AS email';
    $select[] = $userSchema['phone'] ? col('u', $userSchema['phone']) . ' AS telefono' : 'NULL AS telefono';
    $select[] = $userSchema['role'] ? col('u', $userSchema['role']) . ' AS rol_id' : 'NULL AS rol_id';
    $select[] = $userSchema['status'] ? col('u', $userSchema['status']) . ' AS estado' : "'activo' AS estado";
    $select[] = $userSchema['last_access'] ? col('u', $userSchema['last_access']) . ' AS ultimo_acceso' : 'NULL AS ultimo_acceso';

    $join = '';
    if ($schema['roles']['table'] && $schema['roles']['id'] && $userSchema['role']) {
        $roleSchema = $schema['roles'];
        if ($roleSchema['name']) {
            $select[] = col('r', $roleSchema['name']) . ' AS rol_nombre';
        } else {
            $select[] = 'NULL AS rol_nombre';
        }
        $join = ' LEFT JOIN ' . q($roleSchema['table']) . ' r ON ' . col('r', $roleSchema['id']) . ' = ' . col('u', $userSchema['role']);
    } else {
        $select[] = 'NULL AS rol_nombre';
    }

    $sql = 'SELECT ' . implode(', ', $select) . ' FROM ' . q($userSchema['table']) . ' u' . $join . ' ORDER BY ' . col('u', $userSchema['id']) . ' DESC LIMIT 250';
    $stmt = $pdo->query($sql);
    return $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
}

function fetchRoles(PDO $pdo, array $schema): array {
    $roleSchema = $schema['roles'];
    if (!$roleSchema['table'] || !$roleSchema['id']) {
        throw new RuntimeException('No se encontró la tabla de roles.');
    }

    $select = [col('r', $roleSchema['id']) . ' AS rol_id'];
    $select[] = $roleSchema['name'] ? col('r', $roleSchema['name']) . ' AS nombre' : 'NULL AS nombre';
    $select[] = $roleSchema['level'] ? col('r', $roleSchema['level']) . ' AS nivel' : 'NULL AS nivel';
    $select[] = $roleSchema['description'] ? col('r', $roleSchema['description']) . ' AS descripcion' : 'NULL AS descripcion';

    $sql = 'SELECT ' . implode(', ', $select) . ' FROM ' . q($roleSchema['table']) . ' r ORDER BY ' . col('r', $roleSchema['id']) . ' DESC LIMIT 200';
    $stmt = $pdo->query($sql);
    return $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
}

function fetchPermissions(PDO $pdo, array $schema): array {
    $permSchema = $schema['permissions'];
    if (!$permSchema['table'] || !$permSchema['id']) {
        throw new RuntimeException('No se encontró la tabla de permisos.');
    }

    $select = [col('p', $permSchema['id']) . ' AS permiso_id'];
    $select[] = $permSchema['code'] ? col('p', $permSchema['code']) . ' AS codigo' : 'NULL AS codigo';
    $select[] = $permSchema['category'] ? col('p', $permSchema['category']) . ' AS categoria' : 'NULL AS categoria';
    $select[] = $permSchema['description'] ? col('p', $permSchema['description']) . ' AS descripcion' : 'NULL AS descripcion';

    $sql = 'SELECT ' . implode(', ', $select) . ' FROM ' . q($permSchema['table']) . ' p ORDER BY ' . col('p', $permSchema['id']) . ' DESC LIMIT 200';
    $stmt = $pdo->query($sql);
    return $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
}

function fetchRolePermissions(PDO $pdo, array $schema): array {
    $pivotSchema = $schema['role_permissions'];
    if (!$pivotSchema['table'] || !$pivotSchema['role'] || !$pivotSchema['permission']) {
        throw new RuntimeException('No se encontró la tabla de relación rol-permiso.');
    }

    $select = [col('rp', $pivotSchema['role']) . ' AS rol_id'];
    $select[] = col('rp', $pivotSchema['permission']) . ' AS permiso_id';

    $join = '';
    if ($schema['roles']['table'] && $schema['roles']['id'] && $schema['roles']['name']) {
        $join .= ' LEFT JOIN ' . q($schema['roles']['table']) . ' r ON ' . col('r', $schema['roles']['id']) . ' = ' . col('rp', $pivotSchema['role']);
        $select[] = col('r', $schema['roles']['name']) . ' AS rol_nombre';
    } else {
        $select[] = 'NULL AS rol_nombre';
    }

    if ($schema['permissions']['table'] && $schema['permissions']['id'] && $schema['permissions']['code']) {
        $join .= ' LEFT JOIN ' . q($schema['permissions']['table']) . ' p ON ' . col('p', $schema['permissions']['id']) . ' = ' . col('rp', $pivotSchema['permission']);
        $select[] = col('p', $schema['permissions']['code']) . ' AS permiso_codigo';
    } else {
        $select[] = 'NULL AS permiso_codigo';
    }

    $sql = 'SELECT ' . implode(', ', $select) . ' FROM ' . q($pivotSchema['table']) . ' rp' . $join . ' LIMIT 300';
    $stmt = $pdo->query($sql);
    return $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
}

function fetchAudit(PDO $pdo, array $schema): array {
    $auditSchema = $schema['audit'];
    if (!$auditSchema['table']) {
        throw new RuntimeException('No se encontró la tabla de auditoría.');
    }

    $select = [];
    if ($auditSchema['id']) {
        $select[] = col('a', $auditSchema['id']) . ' AS auditoria_id';
    }
    $select[] = $auditSchema['timestamp'] ? col('a', $auditSchema['timestamp']) . ' AS fecha' : 'NULL AS fecha';
    $select[] = $auditSchema['entity'] ? col('a', $auditSchema['entity']) . ' AS entidad' : 'NULL AS entidad';
    $select[] = $auditSchema['action'] ? col('a', $auditSchema['action']) . ' AS accion' : 'NULL AS accion';
    $select[] = $auditSchema['detail'] ? col('a', $auditSchema['detail']) . ' AS detalle' : 'NULL AS detalle';
    $select[] = $auditSchema['user'] ? col('a', $auditSchema['user']) . ' AS usuario' : 'NULL AS usuario';

    $orderBy = $auditSchema['timestamp'] ? col('a', $auditSchema['timestamp']) : ($auditSchema['id'] ? col('a', $auditSchema['id']) : '1');
    $sql = 'SELECT ' . implode(', ', $select) . ' FROM ' . q($auditSchema['table']) . ' a ORDER BY ' . $orderBy . ' DESC LIMIT 300';
    $stmt = $pdo->query($sql);
    return $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
}

function cleanNullable($value) {
    if ($value === null) {
        return null;
    }
    if (is_string($value)) {
        $trimmed = trim($value);
        return $trimmed === '' ? null : $trimmed;
    }
    return $value;
}

function saveUser(PDO $pdo, array $schema, array $payload, $id = null): string {
    $userSchema = $schema['users'];
    if (!$userSchema['table'] || !$userSchema['id']) {
        throw new RuntimeException('No se encontró la tabla de usuarios.');
    }

    $fields = [];
    $params = [];
    $index = 0;

    $map = [
        'nombre' => 'name',
        'email' => 'email',
        'telefono' => 'phone',
        'rol_id' => 'role',
        'estado' => 'status',
        'password_hash' => 'password',
    ];

    foreach ($map as $inputKey => $schemaKey) {
        if (!$userSchema[$schemaKey]) {
            continue;
        }
        if (!array_key_exists($inputKey, $payload)) {
            continue;
        }
        $value = $payload[$inputKey];
        if ($inputKey === 'rol_id') {
            $value = $value === null || $value === '' ? null : (is_numeric($value) ? (int) $value : $value);
        } elseif ($inputKey === 'estado') {
            $value = $value === null ? null : (is_string($value) ? strtolower(trim($value)) : $value);
        } elseif ($inputKey === 'email' && is_string($value)) {
            $value = strtolower(trim($value));
        } else {
            $value = cleanNullable($value);
        }
        if ($inputKey === 'password_hash' && $value === null) {
            continue;
        }
        $placeholder = ':p' . $index++;
        $fields[] = [
            'column' => $userSchema[$schemaKey],
            'placeholder' => $placeholder,
        ];
        $params[$placeholder] = $value;
    }

    if (!$fields) {
        throw new InvalidArgumentException('No se proporcionaron datos válidos para guardar el usuario.');
    }

    if ($id !== null) {
        $setParts = [];
        foreach ($fields as $field) {
            $setParts[] = q($field['column']) . ' = ' . $field['placeholder'];
        }
        $params[':id'] = $id;
        $sql = 'UPDATE ' . q($userSchema['table']) . ' SET ' . implode(', ', $setParts) . ' WHERE ' . q($userSchema['id']) . ' = :id';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return (string) $id;
    }

    $columns = [];
    $placeholders = [];
    foreach ($fields as $field) {
        $columns[] = q($field['column']);
        $placeholders[] = $field['placeholder'];
    }

    $sql = 'INSERT INTO ' . q($userSchema['table']) . ' (' . implode(', ', $columns) . ') VALUES (' . implode(', ', $placeholders) . ')';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $insertedId = $pdo->lastInsertId();
    if (!$insertedId) {
        $insertedId = (string) $pdo->query('SELECT LAST_INSERT_ID()')->fetchColumn();
    }
    return $insertedId ?: '0';
}

function deleteUser(PDO $pdo, array $schema, $id): void {
    $userSchema = $schema['users'];
    if (!$userSchema['table'] || !$userSchema['id']) {
        throw new RuntimeException('No se encontró la tabla de usuarios.');
    }
    $stmt = $pdo->prepare('DELETE FROM ' . q($userSchema['table']) . ' WHERE ' . q($userSchema['id']) . ' = :id LIMIT 1');
    $stmt->execute([':id' => $id]);
}

function saveRole(PDO $pdo, array $schema, array $payload, $id = null): string {
    $roleSchema = $schema['roles'];
    if (!$roleSchema['table'] || !$roleSchema['id']) {
        throw new RuntimeException('No se encontró la tabla de roles.');
    }

    $fields = [];
    $params = [];
    $index = 0;

    $map = [
        'nombre' => 'name',
        'descripcion' => 'description',
        'nivel' => 'level',
    ];

    foreach ($map as $inputKey => $schemaKey) {
        if (!$roleSchema[$schemaKey]) {
            continue;
        }
        if (!array_key_exists($inputKey, $payload)) {
            continue;
        }
        $value = $payload[$inputKey];
        if ($inputKey === 'nivel') {
            $value = $value === null || $value === '' ? null : (is_numeric($value) ? (int) $value : $value);
        } else {
            $value = cleanNullable($value);
        }
        $placeholder = ':p' . $index++;
        $fields[] = [
            'column' => $roleSchema[$schemaKey],
            'placeholder' => $placeholder,
        ];
        $params[$placeholder] = $value;
    }

    if (!$fields) {
        throw new InvalidArgumentException('No se proporcionaron datos válidos para guardar el rol.');
    }

    if ($id !== null) {
        $setParts = [];
        foreach ($fields as $field) {
            $setParts[] = q($field['column']) . ' = ' . $field['placeholder'];
        }
        $params[':id'] = $id;
        $sql = 'UPDATE ' . q($roleSchema['table']) . ' SET ' . implode(', ', $setParts) . ' WHERE ' . q($roleSchema['id']) . ' = :id';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return (string) $id;
    }

    $columns = [];
    $placeholders = [];
    foreach ($fields as $field) {
        $columns[] = q($field['column']);
        $placeholders[] = $field['placeholder'];
    }

    $sql = 'INSERT INTO ' . q($roleSchema['table']) . ' (' . implode(', ', $columns) . ') VALUES (' . implode(', ', $placeholders) . ')';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $insertedId = $pdo->lastInsertId();
    if (!$insertedId) {
        $insertedId = (string) $pdo->query('SELECT LAST_INSERT_ID()')->fetchColumn();
    }
    return $insertedId ?: '0';
}

function deleteRole(PDO $pdo, array $schema, $id): void {
    $roleSchema = $schema['roles'];
    if (!$roleSchema['table'] || !$roleSchema['id']) {
        throw new RuntimeException('No se encontró la tabla de roles.');
    }

    if ($schema['role_permissions']['table'] && $schema['role_permissions']['role']) {
        $stmt = $pdo->prepare('DELETE FROM ' . q($schema['role_permissions']['table']) . ' WHERE ' . q($schema['role_permissions']['role']) . ' = :id');
        $stmt->execute([':id' => $id]);
    }

    if ($schema['users']['table'] && $schema['users']['role']) {
        $stmt = $pdo->prepare('UPDATE ' . q($schema['users']['table']) . ' SET ' . q($schema['users']['role']) . ' = NULL WHERE ' . q($schema['users']['role']) . ' = :id');
        $stmt->execute([':id' => $id]);
    }

    $stmt = $pdo->prepare('DELETE FROM ' . q($roleSchema['table']) . ' WHERE ' . q($roleSchema['id']) . ' = :id LIMIT 1');
    $stmt->execute([':id' => $id]);
}

function savePermission(PDO $pdo, array $schema, array $payload, $id = null): string {
    $permSchema = $schema['permissions'];
    if (!$permSchema['table'] || !$permSchema['id']) {
        throw new RuntimeException('No se encontró la tabla de permisos.');
    }

    $fields = [];
    $params = [];
    $index = 0;

    $map = [
        'codigo' => 'code',
        'categoria' => 'category',
        'descripcion' => 'description',
    ];

    foreach ($map as $inputKey => $schemaKey) {
        if (!$permSchema[$schemaKey]) {
            continue;
        }
        if (!array_key_exists($inputKey, $payload)) {
            continue;
        }
        $value = cleanNullable($payload[$inputKey]);
        $placeholder = ':p' . $index++;
        $fields[] = [
            'column' => $permSchema[$schemaKey],
            'placeholder' => $placeholder,
        ];
        $params[$placeholder] = $value;
    }

    if (!$fields) {
        throw new InvalidArgumentException('No se proporcionaron datos válidos para guardar el permiso.');
    }

    if ($id !== null) {
        $setParts = [];
        foreach ($fields as $field) {
            $setParts[] = q($field['column']) . ' = ' . $field['placeholder'];
        }
        $params[':id'] = $id;
        $sql = 'UPDATE ' . q($permSchema['table']) . ' SET ' . implode(', ', $setParts) . ' WHERE ' . q($permSchema['id']) . ' = :id';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return (string) $id;
    }

    $columns = [];
    $placeholders = [];
    foreach ($fields as $field) {
        $columns[] = q($field['column']);
        $placeholders[] = $field['placeholder'];
    }

    $sql = 'INSERT INTO ' . q($permSchema['table']) . ' (' . implode(', ', $columns) . ') VALUES (' . implode(', ', $placeholders) . ')';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $insertedId = $pdo->lastInsertId();
    if (!$insertedId) {
        $insertedId = (string) $pdo->query('SELECT LAST_INSERT_ID()')->fetchColumn();
    }
    return $insertedId ?: '0';
}

function deletePermission(PDO $pdo, array $schema, $id): void {
    $permSchema = $schema['permissions'];
    if (!$permSchema['table'] || !$permSchema['id']) {
        throw new RuntimeException('No se encontró la tabla de permisos.');
    }

    if ($schema['role_permissions']['table'] && $schema['role_permissions']['permission']) {
        $stmt = $pdo->prepare('DELETE FROM ' . q($schema['role_permissions']['table']) . ' WHERE ' . q($schema['role_permissions']['permission']) . ' = :id');
        $stmt->execute([':id' => $id]);
    }

    $stmt = $pdo->prepare('DELETE FROM ' . q($permSchema['table']) . ' WHERE ' . q($permSchema['id']) . ' = :id LIMIT 1');
    $stmt->execute([':id' => $id]);
}

function saveRolePermission(PDO $pdo, array $schema, $roleId, $permissionId): void {
    $pivotSchema = $schema['role_permissions'];
    if (!$pivotSchema['table'] || !$pivotSchema['role'] || !$pivotSchema['permission']) {
        throw new RuntimeException('No se encontró la tabla de relación rol-permiso.');
    }

    $roleId = is_numeric($roleId) ? (int) $roleId : $roleId;
    $permissionId = is_numeric($permissionId) ? (int) $permissionId : $permissionId;

    $stmt = $pdo->prepare(
        'SELECT 1 FROM ' . q($pivotSchema['table']) . ' WHERE ' . q($pivotSchema['role']) . ' = :rol AND ' . q($pivotSchema['permission']) . ' = :perm LIMIT 1'
    );
    $stmt->execute([':rol' => $roleId, ':perm' => $permissionId]);
    if ($stmt->fetchColumn()) {
        return;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO ' . q($pivotSchema['table']) . ' (' . q($pivotSchema['role']) . ', ' . q($pivotSchema['permission']) . ') VALUES (:rol, :perm)'
    );
    $stmt->execute([':rol' => $roleId, ':perm' => $permissionId]);
}

function deleteRolePermission(PDO $pdo, array $schema, $roleId, $permissionId): void {
    $pivotSchema = $schema['role_permissions'];
    if (!$pivotSchema['table'] || !$pivotSchema['role'] || !$pivotSchema['permission']) {
        throw new RuntimeException('No se encontró la tabla de relación rol-permiso.');
    }

    $stmt = $pdo->prepare(
        'DELETE FROM ' . q($pivotSchema['table']) . ' WHERE ' . q($pivotSchema['role']) . ' = :rol AND ' . q($pivotSchema['permission']) . ' = :perm LIMIT 1'
    );
    $stmt->execute([
        ':rol' => $roleId,
        ':perm' => $permissionId,
    ]);
}

$entity = normalizeEntity($_GET['entity'] ?? '');
if ($entity === '') {
    respondError(400, 'Debes especificar el parámetro entity.');
}

$schema = detectSchema($pdo);
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    switch ($method) {
        case 'GET':
            if ($entity === 'users') {
                $rows = fetchUsers($pdo, $schema);
                respondSuccess(['data' => $rows]);
            }
            if ($entity === 'roles') {
                $rows = fetchRoles($pdo, $schema);
                respondSuccess(['data' => $rows]);
            }
            if ($entity === 'permissions') {
                $rows = fetchPermissions($pdo, $schema);
                respondSuccess(['data' => $rows]);
            }
            if ($entity === 'role-permissions' || $entity === 'rolepermissions' || $entity === 'role-permission') {
                $rows = fetchRolePermissions($pdo, $schema);
                respondSuccess(['data' => $rows]);
            }
            if ($entity === 'audit' || $entity === 'audits' || $entity === 'bitacora') {
                $rows = fetchAudit($pdo, $schema);
                respondSuccess(['data' => $rows]);
            }
            respondError(404, 'Entidad no soportada.');
            break;

        case 'POST':
            $data = readJsonInput();
            if ($entity === 'users') {
                $id = saveUser($pdo, $schema, $data, null);
                respondSuccess(['data' => ['id' => $id]]);
            }
            if ($entity === 'roles') {
                $id = saveRole($pdo, $schema, $data, null);
                respondSuccess(['data' => ['id' => $id]]);
            }
            if ($entity === 'permissions') {
                $id = savePermission($pdo, $schema, $data, null);
                respondSuccess(['data' => ['id' => $id]]);
            }
            if ($entity === 'role-permissions' || $entity === 'rolepermissions' || $entity === 'role-permission') {
                $roleId = $data['rol_id'] ?? $data['role_id'] ?? null;
                $permissionId = $data['permiso_id'] ?? $data['permission_id'] ?? null;
                if ($roleId === null || $permissionId === null) {
                    respondError(400, 'Debes indicar rol_id y permiso_id.');
                }
                saveRolePermission($pdo, $schema, $roleId, $permissionId);
                respondSuccess(['data' => ['rol_id' => $roleId, 'permiso_id' => $permissionId]]);
            }
            respondError(404, 'Entidad no soportada para POST.');
            break;

        case 'PUT':
        case 'PATCH':
            $data = readJsonInput();
            $id = $_GET['id'] ?? null;
            if ($id === null) {
                respondError(400, 'Debes indicar el parámetro id.');
            }
            if ($entity === 'users') {
                saveUser($pdo, $schema, $data, $id);
                respondSuccess(['data' => ['id' => $id]]);
            }
            if ($entity === 'roles') {
                saveRole($pdo, $schema, $data, $id);
                respondSuccess(['data' => ['id' => $id]]);
            }
            if ($entity === 'permissions') {
                savePermission($pdo, $schema, $data, $id);
                respondSuccess(['data' => ['id' => $id]]);
            }
            respondError(404, 'Entidad no soportada para actualización.');
            break;

        case 'DELETE':
            if ($entity === 'users') {
                $id = $_GET['id'] ?? null;
                if ($id === null) {
                    respondError(400, 'Debes indicar el parámetro id.');
                }
                deleteUser($pdo, $schema, $id);
                respondSuccess(['success' => true]);
            }
            if ($entity === 'roles') {
                $id = $_GET['id'] ?? null;
                if ($id === null) {
                    respondError(400, 'Debes indicar el parámetro id.');
                }
                deleteRole($pdo, $schema, $id);
                respondSuccess(['success' => true]);
            }
            if ($entity === 'permissions') {
                $id = $_GET['id'] ?? null;
                if ($id === null) {
                    respondError(400, 'Debes indicar el parámetro id.');
                }
                deletePermission($pdo, $schema, $id);
                respondSuccess(['success' => true]);
            }
            if ($entity === 'role-permissions' || $entity === 'rolepermissions' || $entity === 'role-permission') {
                $roleId = $_GET['rol_id'] ?? $_GET['role_id'] ?? null;
                $permissionId = $_GET['permiso_id'] ?? $_GET['permission_id'] ?? null;
                if ($roleId === null || $permissionId === null) {
                    respondError(400, 'Debes indicar rol_id y permiso_id.');
                }
                deleteRolePermission($pdo, $schema, $roleId, $permissionId);
                respondSuccess(['success' => true]);
            }
            respondError(404, 'Entidad no soportada para eliminación.');
            break;

        default:
            respondError(405, 'Método no permitido.');
    }
} catch (InvalidArgumentException $error) {
    respondError(400, $error->getMessage());
} catch (Throwable $error) {
    respondError(500, $error->getMessage());
}
