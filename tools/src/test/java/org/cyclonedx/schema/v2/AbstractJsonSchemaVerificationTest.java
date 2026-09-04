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
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import org.apache.commons.io.IOUtils;
import org.apache.commons.lang3.StringUtils;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestReporter;

/**
 * Verifies a CycloneDX 2.x JSON schema against its JSON test data.
 * <p>
 * Subclass once per schema version, passing the version to the constructor
 * and adding the appropriate {@code @Tag} annotations for test filtering.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
abstract class AbstractJsonSchemaVerificationTest {

    private static final ObjectMapper MAPPER = new JsonMapper();

    private static final String SPDX_NAMESPACE = "cyclonedx.org/schema/spdx.schema.json";
    private static final String CRYPTO_DEF_NAMESPACE = "cyclonedx.org/schema/cryptography-defs.schema.json";
    private static final String BEHAVIOR_TAXONOMY_NAMESPACE = "cyclonedx.org/schema/behavior-taxonomy.schema.json";
    private static final String PERSPECTIVES_DEFS_NAMESPACE = "cyclonedx.org/schema/perspectives-defs.schema.json";

    private final String version;

    /** Compiled lazily in {@link #compileSchema()} for clear failure attribution. */
    private JsonSchema schema;

    protected AbstractJsonSchemaVerificationTest(final String version) {
        this.version = version;
    }

    /**
     * Compiles the schema before any test runs. A broken schema fails here,
     * clearly attributed to this lifecycle step, instead of surfacing as an
     * opaque test-instantiation error.
     */
    @BeforeAll
    void compileSchema() {
        this.schema = buildSchema(version);
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

    /** Lists all test-data resources for this schema version. */
    private List<String> getVersionResources() throws IOException {
        final String resourceDirectory = version + "/";
        final List<String> resources = new ArrayList<>();
        try (InputStream in = getClass().getClassLoader().getResourceAsStream(resourceDirectory)) {
            if (in != null) {
                IOUtils.readLines(in, StandardCharsets.UTF_8)
                    .forEach(resource -> resources.add(resourceDirectory + resource));
            }
        }
        return resources;
    }

    @TestFactory
    Collection<DynamicTest> verifyTestData(final TestReporter reporter) throws Exception {
        final List<DynamicTest> dynamicTests = new ArrayList<>();
        for (final String resource : getVersionResources()) {
            final String resourceName = StringUtils.substringAfterLast(resource, "/");
            if (!resourceName.endsWith(".json")) {
                continue;
            }
            if (resourceName.startsWith("valid")) {
                dynamicTests.add(resourceTest(reporter, resource, true));
            } else if (resourceName.startsWith("invalid")) {
                dynamicTests.add(resourceTest(reporter, resource, false));
            }
        }
        assertFalse(dynamicTests.isEmpty(), "no JSON test data found for schema version " + version);
        return dynamicTests;
    }

    /** Creates a test that validates the resource, reporting progress via the JUnit platform. */
    private DynamicTest resourceTest(final TestReporter reporter, final String resource, final boolean expectValid) {
        return DynamicTest.dynamicTest(resource, () -> {
            reporter.publishEntry("validating", resource + " (expect " + (expectValid ? "pass" : "fail") + ")");
            if (expectValid) {
                assertTrue(isValid(resource), resource);
            } else {
                assertFalse(isValid(resource), resource);
            }
        });
    }

    private boolean isValid(final String resource) {
        try (InputStream input = getClass().getClassLoader().getResourceAsStream(resource);
             JsonParser parser = MAPPER.createParser(input)) {
            JsonNode node = parser.readValueAsTree();
            return schema.validate(node).isEmpty();
        } catch (IOException e) {
            // broken/unreadable test data must fail loudly,
            // not masquerade as schema rejection
            throw new UncheckedIOException(e);
        }
    }
}
