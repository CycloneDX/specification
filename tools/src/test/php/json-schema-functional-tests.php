<?php declare(strict_types=1);

/**
 * validate all test data for a given version of CycloneDX.
 * call the script via `php -f <this-file> -- -v <CDX-version>`
 */

use Opis\JsonSchema;

require_once __DIR__ . '/vendor/autoload.php';

// region config

define('TESTSCHEMA_VERSION', getopt('v:')['v']);
define('SCHEMA_DIR', realpath(__DIR__ . '/../../../../schema'));
define('SCHEMA_FILE', SCHEMA_DIR . '/bom-' . TESTSCHEMA_VERSION . '.schema.json');
define('TESTDATA_DIR', realpath(__DIR__ . '/../resources/' . TESTSCHEMA_VERSION));

if (empty(TESTSCHEMA_VERSION)) {
    throw new Exception('missing TESTSCHEMA_VERSION. expected via opt "-v"');
}
fwrite(STDOUT, 'DEBUG | TESTSCHEMA_VERSION = ' . TESTSCHEMA_VERSION . PHP_EOL);

if (!is_file(SCHEMA_FILE)) {
    throw new Exception('missing SCHEMA_FILE: ' . SCHEMA_FILE);
}
fwrite(STDOUT, 'DEBUG | SCHEMA_FILE = ' . SCHEMA_FILE . PHP_EOL);

if (!is_dir(TESTDATA_DIR)) {
    throw new Exception('missing TESTDATA_DIR: ' . TESTDATA_DIR);
}
fwrite(STDOUT, 'DEBUG | TESTDATA_DIR = ' . TESTDATA_DIR . PHP_EOL);

// endregion config

// region validator

$schemaId = uniqid('validate:cdx-test?f=' . SCHEMA_FILE . '&r=', true);
$resolver = new JsonSchema\Resolvers\SchemaResolver();
$resolver->registerFile($schemaId, SCHEMA_FILE);
$resolver->registerPrefix('http://cyclonedx.org/schema/', SCHEMA_DIR);
$validator = new JsonSchema\Validator();
$validator->setResolver($resolver);
$errorFormatter = new JsonSchema\Errors\ErrorFormatter();

/**
 * @param string $file file path to validate
 */
function validateFile(string $file): ?JsonSchema\Errors\ValidationError
{
    global $validator, $schemaId;
    return $validator->validate(
        json_decode(file_get_contents($file), false, 1024, \JSON_THROW_ON_ERROR),
        $schemaId
    )->error();
}

// endregion validator

$errCnt = 0;

foreach (glob(TESTDATA_DIR . '/valid-*.json') as $file) {
    fwrite(STDOUT, PHP_EOL . "test $file ..." . PHP_EOL);
    $validationError = validateFile($file);
    if ($validationError === null) {
        fwrite(STDOUT, 'OK.' . PHP_EOL);
    } else {
        ++$errCnt;
        fwrite(STDERR, "ERROR: Unexpected validation error for file: $file" . PHP_EOL);
        fwrite(STDERR, json_encode(
                $errorFormatter->format($validationError),
                JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
            ) . PHP_EOL);
    }
    unset($validationError);
}

foreach (glob(TESTDATA_DIR . '/invalid-*.json') as $file) {
    fwrite(STDOUT, PHP_EOL . "test $file ..." . PHP_EOL);
    $validationError = validateFile($file);
    if ($validationError === null) {
        ++$errCnt;
        fwrite(STDERR, "ERROR: Missing expected validation error for file: $file" . PHP_EOL);
    } else {
        fwrite(STDOUT, 'OK.' . PHP_EOL);
    }
    unset($validationError);
}


// Exit statuses should be in the range 0 to 254, the exit status 255 is reserved by PHP and shall not be used.
// The status 0 is used to terminate the program successfully.
exit(min($errCnt, 254));