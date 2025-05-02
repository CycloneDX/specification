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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import javax.xml.XMLConstants;
import javax.xml.transform.stream.StreamSource;
import javax.xml.validation.Schema;
import javax.xml.validation.SchemaFactory;
import javax.xml.validation.Validator;
import org.apache.commons.lang3.StringUtils;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;
import org.xml.sax.ErrorHandler;
import org.xml.sax.SAXException;
import org.xml.sax.SAXParseException;

public class XmlSchemaVerificationTest extends BaseSchemaVerificationTest {

    private static final Schema VERSION_10;
    private static final Schema VERSION_11;
    private static final Schema VERSION_12;
    private static final Schema VERSION_13;
    private static final Schema VERSION_14;
    private static final Schema VERSION_15;
    private static final Schema VERSION_16;
    private static final Schema VERSION_17;

    static {
        try {
            SchemaFactory factory = SchemaFactory.newInstance(XMLConstants.W3C_XML_SCHEMA_NS_URI);
            factory.setProperty(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "file");
            ClassLoader cl = XmlSchemaVerificationTest.class.getClassLoader();
            // Override the `schemaLocation` property in the file
            factory.setProperty(
                    "http://apache.org/xml/properties/schema/external-schemaLocation",
                    "http://cyclonedx.org/schema/spdx spdx.xsd");
            VERSION_10 = factory.newSchema(cl.getResource("bom-1.0.xsd"));
            VERSION_11 = factory.newSchema(cl.getResource("bom-1.1.xsd"));
            VERSION_12 = factory.newSchema(cl.getResource("bom-1.2.xsd"));
            VERSION_13 = factory.newSchema(cl.getResource("bom-1.3.xsd"));
            VERSION_14 = factory.newSchema(cl.getResource("bom-1.4.xsd"));
            VERSION_15 = factory.newSchema(cl.getResource("bom-1.5.xsd"));
            VERSION_16 = factory.newSchema(cl.getResource("bom-1.6.xsd"));
            VERSION_17 = factory.newSchema(cl.getResource("bom-1.7.xsd"));
        } catch (SAXException e) {
            throw new IllegalStateException(e);
        }
    }

    /**
     * Generates a collection of dynamic tests based on the available XML files.
     *
     * @return Collection<DynamicTest> a collection of dynamic tests
     * @throws Exception if an error occurs during the generation of the dynamic tests
     */
    @TestFactory
    Collection<DynamicTest> dynamicTestsWithCollection() throws Exception {
        final List<String> resources = getAllResources();
        final List<DynamicTest> dynamicTests = new ArrayList<>();
        for (final String resource : resources) {
            String resourceName = StringUtils.substringAfterLast(resource, "/");
            if (resourceName.endsWith(".xml")) {
                Schema schema = getSchema(resourceName);
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

    /**
     * Validates the given XML file against the specified CycloneDX schema version.
     *
     * @param schema  the CycloneDX schema to validate against
     * @param resource the path to the XML file to be validated
     * @return boolean   true if the XML file is valid according to the specified schema version, false otherwise
     * @throws Exception if an error occurs during the validation process
     */
    private boolean isValid(Schema schema, String resource) throws Exception {
        Validator validator = schema.newValidator();
        validator.setErrorHandler(new ErrorHandler() {
            @Override
            public void warning(SAXParseException exception) throws SAXException {
                throw exception;
            }

            @Override
            public void error(SAXParseException exception) throws SAXException {
                throw exception;
            }

            @Override
            public void fatalError(SAXParseException exception) throws SAXException {
                throw exception;
            }
        });
        try {
            validator.validate(new StreamSource(getClass().getClassLoader().getResourceAsStream(resource)));
        } catch (SAXParseException e) {
            return false;
        }
        return true;
    }

    private Schema getSchema(String resourceName) {
        if (resourceName.endsWith("-1.0.xml")) {
            return VERSION_10;
        }
        if (resourceName.endsWith("-1.1.xml")) {
            return VERSION_11;
        }
        if (resourceName.endsWith("-1.2.xml")) {
            return VERSION_12;
        }
        if (resourceName.endsWith("-1.3.xml")) {
            return VERSION_13;
        }
        if (resourceName.endsWith("-1.4.xml")) {
            return VERSION_14;
        }
        if (resourceName.endsWith("-1.5.xml")) {
            return VERSION_15;
        }
        if (resourceName.endsWith("-1.6.xml")) {
            return VERSION_16;
        }
        if (resourceName.endsWith("-1.7.xml")) {
            return VERSION_17;
        }
        return null;
    }
}
