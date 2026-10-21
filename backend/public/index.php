<?php
/**
 * SISTEM TIMBANG & SUSUT RPHU - FRONT CONTROLLER
 * Entry point for REST API requests.
 */

declare(strict_types=1);

// Handle CORS Headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Simple PSR-4 Autoloader fallback if composer install hasn't been run
spl_autoload_register(function ($class) {
    $prefix = 'App\\';
    $baseDir = __DIR__ . '/../app/';

    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    $relativeClass = substr($class, $len);
    $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';

    if (file_exists($file)) {
        require_once $file;
    }
});

// Require Helpers
require_once __DIR__ . '/../app/Helpers/response.php';
require_once __DIR__ . '/../app/Helpers/validation.php';

// Route Dispatching
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$requestMethod = $_SERVER['REQUEST_METHOD'];

// Load routes
$routes = require __DIR__ . '/../app/Routes/api.php';

$matched = false;
foreach ($routes as $route) {
    if ($route['method'] === $requestMethod) {
        // Simple regex matching for dynamic parameters e.g. /api/v1/devices/{id}
        $pattern = preg_replace('/\{([a-zA-Z0-9_]+)\}/', '(?P<$1>[^/]+)', $route['path']);
        $pattern = "#^" . $pattern . "$#";

        if (preg_match($pattern, $requestUri, $matches)) {
            $matched = true;
            $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
            
            [$controllerClass, $method] = $route['handler'];
            if (class_exists($controllerClass)) {
                $controller = new $controllerClass();
                if (method_exists($controller, $method)) {
                    $controller->$method($params);
                } else {
                    jsonResponse(false, "Method {$method} tidak ditemukan pada controller", null, 500);
                }
            } else {
                jsonResponse(false, "Controller {$controllerClass} tidak ditemukan", null, 500);
            }
            break;
        }
    }
}

if (!$matched) {
    // If accessing root, show system health check
    if ($requestUri === '/' || $requestUri === '/api' || $requestUri === '/api/v1') {
        jsonResponse(true, "Sistem Timbang & Susut RPHU - REST API v1.0 Online", [
            'app_name' => 'Sistem Timbang RPHU',
            'version'  => '1.0.0',
            'docs'     => '/docs/spesifikasi-api.md',
            'status'   => 'healthy',
            'time'     => date('c')
        ]);
    } else {
        jsonResponse(false, "Endpoint tidak ditemukan: {$requestMethod} {$requestUri}", null, 404);
    }
}
