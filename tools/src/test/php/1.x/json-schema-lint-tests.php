<?php declare(strict_types=1);

// region config

const SchemaFileGlob = '*.schema.json';
const SchemaDir = __DIR__.'/../../../../schema/';

// endregion config

// region pre-check

if (!is_dir(SchemaDir)) {
    throw new RuntimeException('No such dir: '.SchemaDir);
}

$schemasFiles = glob(SchemaDir.SchemaFileGlob, GLOB_ERR);
if (empty($schemasFiles)) {
    throw new RuntimeException('No schema files found');
}

// region pre-check

require_once __DIR__.'/vendor/autoload.php';

$errCnt = 0;

foreach ($schemasFiles as $schemasFilePath) {
    echo PHP_EOL, "SchemaFile: $schemasFilePath", PHP_EOL;

    try {
        $schema = json_decode(file_get_contents($schemasFilePath), false, 512, JSON_THROW_ON_ERROR);
        if (!is_object($schema)) {
            throw new DomainException('decode to a non-object');
        }
    } catch (Exception $exception) {
        ++$errCnt;
        echo 'JSON DECODE ERROR: ', $exception->getMessage(), PHP_EOL;
        continue;
    }

    try {
        // run on individual instances, so no pollution or artifacts can distort tests
        (new Opis\JsonSchema\SchemaLoader())->loadObjectSchema($schema);
        echo 'OK.', PHP_EOL;
    } catch (Opis\JsonSchema\Exceptions\SchemaException $exception) {
        ++$errCnt;
        echo 'SCHEMA ERROR: ', $exception->getMessage(), PHP_EOL;
        continue;
    } catch (Exception $exception) {
        ++$errCnt;
        echo 'UNEXPECTED ERROR: ', $exception->getMessage(), PHP_EOL;
        continue;
    }
}

// Exit statuses should be in the range 0 to 254, the exit status 255 is reserved by PHP and shall not be used.
// The status 0 is used to terminate the program successfully.
exit(min($errCnt, 254));
