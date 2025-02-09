/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.cyclonedx.schema;

import static java.util.Objects.requireNonNull;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.networknt.schema.DefaultJsonMetaSchemaFactory;
import com.networknt.schema.DisallowUnknownKeywordFactory;
import com.networknt.schema.JsonMetaSchema;
import com.networknt.schema.JsonMetaSchemaFactory;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.NonValidationKeyword;
import com.networknt.schema.SchemaId;
import com.networknt.schema.SchemaValidatorsConfig;
import java.io.IOException;
import java.io.InputStream;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import org.apache.commons.lang3.StringUtils;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;

class JsonSchemaVerificationTest extends BaseSchemaVerificationTest {

    private static final ObjectMapper MAPPER = new JsonMapper();

    private static final JsonSchema VERSION_12;
    private static final JsonSchema VERSION_13;
    private static final JsonSchema VERSION_14;
    private static final JsonSchema VERSION_15;
    private static final JsonSchema VERSION_16;

    static {
        JsonMetaSchemaFactory metaSchemaFactory = new DefaultJsonMetaSchemaFactory() {
            @Override
            public JsonMetaSchema getMetaSchema(
                    String iri, JsonSchemaFactory schemaFactory, SchemaValidatorsConfig config) {
                return addCustomKeywords(super.getMetaSchema(iri, schemaFactory, config));
            }
        };
        JsonSchemaFactory factory = JsonSchemaFactory.builder()
                .defaultMetaSchemaIri(SchemaId.V7)
                .metaSchema(addCustomKeywords(JsonMetaSchema.getV7()))
                .metaSchemaFactory(metaSchemaFactory)
                .build();
        ClassLoader cl = JsonSchemaVerificationTest.class.getClassLoader();
        try {
            VERSION_12 = factory.getSchema(
                    requireNonNull(cl.getResource("bom-1.2-strict.schema.json")).toURI());
            VERSION_13 = factory.getSchema(
                    requireNonNull(cl.getResource("bom-1.3-strict.schema.json")).toURI());
            VERSION_14 = factory.getSchema(
                    requireNonNull(cl.getResource("bom-1.4.schema.json")).toURI());
            VERSION_15 = factory.getSchema(
                    requireNonNull(cl.getResource("bom-1.5.schema.json")).toURI());
            VERSION_16 = factory.getSchema(
                    requireNonNull(cl.getResource("bom-1.6.schema.json")).toURI());
        } catch (URISyntaxException e) {
            throw new IllegalStateException(e);
        }
    }

    private static JsonMetaSchema addCustomKeywords(JsonMetaSchema metaSchema) {
        return JsonMetaSchema.builder(metaSchema)
                // Non-standard keywords in the CycloneDX schema files.
                .keyword(new NonValidationKeyword("deprecated"))
                .keyword(new NonValidationKeyword("meta:enum"))
                .unknownKeywordFactory(new DisallowUnknownKeywordFactory())
                .build();
    }

    @TestFactory
    Collection<DynamicTest> dynamicTestsWithCollection() throws Exception {
        final List<String> resources = getAllResources();
        final List<DynamicTest> dynamicTests = new ArrayList<>();
        for (final String resource : resources) {
            String resourceName = StringUtils.substringAfterLast(resource, "/");
            if (resourceName.endsWith(".json")) {
                JsonSchema schema = getSchema(resourceName);
                if (schema != null) {
                    if (resourceName.startsWith("valid")) {
                        dynamicTests.add(DynamicTest.dynamicTest(
                                resource, () -> assertTrue(isValid(schema, resource), resource)));
                    } else if (resourceName.startsWith("invalid")) {
                        dynamicTests.add(DynamicTest.dynamicTest(
                                resource, () -> assertFalse(isValid(schema, resource), resource)));
                    }
                }
            }
        }
        return dynamicTests;
    }

    private boolean isValid(JsonSchema schema, String resource) {
        try (InputStream input = getClass().getClassLoader().getResourceAsStream(resource);
                JsonParser parser = MAPPER.createParser(input)) {
            JsonNode node = parser.readValueAsTree();
            return schema.validate(node).isEmpty();
        } catch (IOException e) {
            return false;
        }
    }

    private JsonSchema getSchema(String resourceName) {
        if (resourceName.endsWith("-1.2.json")) {
            return VERSION_12;
        }
        if (resourceName.endsWith("-1.3.json")) {
            return VERSION_13;
        }
        if (resourceName.endsWith("-1.4.json")) {
            return VERSION_14;
        }
        if (resourceName.endsWith("-1.5.json")) {
            return VERSION_15;
        }
        if (resourceName.endsWith("-1.6.json")) {
            return VERSION_16;
        }
        return null;
    }
}
