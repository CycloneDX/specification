<?php declare(strict_types=1);

const SchemaDir =  __DIR__.'/../../../../schema/';

const SchemasFiles = [
    SchemaDir.'/bom-1.2.schema.json',
    SchemaDir.'/bom-1.2-strict.schema.json',
    SchemaDir.'/bom-1.3.schema.json',
    SchemaDir.'/bom-1.3-strict.schema.json',
    SchemaDir.'/bom-1.4-SNAPSHOT.schema.json',
    SchemaDir.'/bom-1.4.schema.json',
    SchemaDir.'/bom-1.4-strict.schema.json',
    SchemaDir.'/jsf-0.82.schema.json',
    SchemaDir.'/spdx.schema.json',
];

require_once __DIR__.'/vendor/autoload.php';

$errCnt = 0;
$schemaLoader = new Opis\JsonSchema\SchemaLoader();

foreach (SchemasFiles as $schemasFile) {
    $schemasFile = realpath($schemasFile);
    if (!$schemasFile) {
        // skip
        continue;
    }
    echo PHP_EOL, "Schema: $schemasFile", PHP_EOL;

    try {
        $schema = json_decode(file_get_contents($schemasFile), false, 512, JSON_THROW_ON_ERROR);
        if (!is_object($schema)) {
            throw new DomainException("decode to a non-object");
        }
    }
    catch (Exception $exception)
    {
        ++$errCnt;
        echo "JSON DECODE ERROR: ", $exception->getMessage(), PHP_EOL;
        continue;
    }

    try {
        $schemaLoader->loadObjectSchema($schema);
        echo "OK.", PHP_EOL;
    } catch (Opis\JsonSchema\Exceptions\SchemaException $exception) {
        ++$errCnt;
        echo "SCHEMA ERROR: ", $exception->getMessage(), PHP_EOL;
        continue;
    } catch (Exception $exception) {
        ++$errCnt;
        echo "UNEXPECTED ERROR:", $exception->getMessage(), PHP_EOL;
        continue;
    }
}

exit($errCnt);