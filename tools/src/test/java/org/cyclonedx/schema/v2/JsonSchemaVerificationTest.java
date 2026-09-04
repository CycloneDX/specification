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
package org.cyclonedx.schema.v2;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.networknt.schema.DefaultJsonMetaSchemaFactory;
import com.networknt.schema.DisallowUnknownKeywordFactory;
import com.networknt.schema.ExecutionContext;
import com.networknt.schema.Format;
import com.networknt.schema.JsonMetaSchema;
import com.networknt.schema.JsonMetaSchemaFactory;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.NonValidationKeyword;
import com.networknt.schema.SchemaId;
import com.networknt.schema.SchemaLocation;
import com.networknt.schema.SchemaValidatorsConfig;
import com.networknt.schema.resource.ClasspathSchemaLoader;
import com.networknt.schema.resource.DisallowSchemaLoader;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.apache.commons.lang3.StringUtils;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.TestFactory;

@Tag("schema-v2")
class JsonSchemaVerificationTest extends BaseSchemaVerificationTest {

    private static final ObjectMapper MAPPER = new JsonMapper();

    private static final String SPDX_NAMESPACE = "cyclonedx.org/schema/spdx.schema.json";
    private static final String CRYPTO_DEF_NAMESPACE = "cyclonedx.org/schema/cryptography-defs.schema.json";
    private static final String BEHAVIOR_TAXONOMY_NAMESPACE = "cyclonedx.org/schema/behavior-taxonomy.schema.json";
    private static final String PERSPECTIVES_DEFS_NAMESPACE = "cyclonedx.org/schema/perspectives-defs.schema.json";

    /** version -> compiled schema. Add new versions here. */
    private static final Map<String, JsonSchema> SCHEMAS = new LinkedHashMap<>();

    static {
        // future: SCHEMAS.put("2.1", buildSchema("2.1"));
        SCHEMAS.put("2.0", buildSchema("2.0"));
    }

    private static JsonSchema buildSchema(final String version) {
        JsonMetaSchemaFactory metaSchemaFactory = new DefaultJsonMetaSchemaFactory() {
            @Override
            public JsonMetaSchema getMetaSchema(
                    String iri, JsonSchemaFactory schemaFactory, SchemaValidatorsConfig config) {
                return addCustomKeywords(super.getMetaSchema(iri, schemaFactory, config));
            }
        };
        JsonSchemaFactory factory = JsonSchemaFactory.builder()
                // main schema and models are 2020-12
                .defaultMetaSchemaIri(SchemaId.V202012)
                .metaSchema(addCustomKeywords(JsonMetaSchema.getV202012()))
                // referenced externals may still be draft-07
                .metaSchema(addCustomKeywords(JsonMetaSchema.getV7()))
                .metaSchemaFactory(metaSchemaFactory)
                .schemaLoaders(b -> b.add(new ClasspathSchemaLoader()).add(DisallowSchemaLoader.getInstance()))
                .schemaMappers(b -> b
                        .mapPrefix("https://cyclonedx.org/schema/" + version + "/model/",
                                "classpath:" + version + "/model/")
                        // version-independent externals
                        .mapPrefix("https://" + SPDX_NAMESPACE, "classpath:spdx.schema.json")
                        .mapPrefix("http://" + SPDX_NAMESPACE, "classpath:spdx.schema.json")
                        .mapPrefix("https://" + CRYPTO_DEF_NAMESPACE, "classpath:cryptography-defs.schema.json")
                        .mapPrefix("http://" + CRYPTO_DEF_NAMESPACE, "classpath:cryptography-defs.schema.json")
                        .mapPrefix("http://" + BEHAVIOR_TAXONOMY_NAMESPACE, "classpath:behavior-taxonomy.schema.json")
                        .mapPrefix("https://" + BEHAVIOR_TAXONOMY_NAMESPACE, "classpath:behavior-taxonomy.schema.json")
                        .mapPrefix("http://" + PERSPECTIVES_DEFS_NAMESPACE, "classpath:perspectives-defs.schema.json")
                        .mapPrefix("https://" + PERSPECTIVES_DEFS_NAMESPACE, "classpath:perspectives-defs.schema.json")
                ).build();
        SchemaValidatorsConfig config = SchemaValidatorsConfig.builder()
                // in 2020-12, "format" is annotation-only unless asserted
                .formatAssertionsEnabled(true)
                .build();
        return factory.getSchema(
                SchemaLocation.of("classpath:" + version + "/cyclonedx-" + version + ".schema.json"),
                config);
    }

    private static JsonMetaSchema addCustomKeywords(JsonMetaSchema metaSchema) {
        return JsonMetaSchema.builder(metaSchema)
                // Non-standard keywords in the CycloneDX schema files.
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
        for (Map.Entry<String, JsonSchema> entry : SCHEMAS.entrySet()) {
            if (resourceName.endsWith("-" + entry.getKey() + ".json")) {
                return entry.getValue();
            }
        }
        return null;
    }
}
