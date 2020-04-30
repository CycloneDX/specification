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

import org.apache.commons.io.FileUtils;
import org.cyclonedx.BomParser;
import org.cyclonedx.CycloneDxSchema;
import org.everit.json.schema.ValidationException;
import org.json.JSONObject;
import org.junit.Assert;
import org.junit.Test;
import java.io.File;
import java.nio.charset.StandardCharsets;

public class JsonSchemaVerificationTest {

    @Test
    public void testValid_12() throws Exception {
        Assert.assertTrue(isValidJson(CycloneDxSchema.Version.VERSION_12, "/bom-1.2.json"));
    }

    @Test
    public void testInvalidSerialNumber() throws Exception {
        Assert.assertFalse(isValidJson(CycloneDxSchema.Version.VERSION_12, "/invalid-serialnumber-1.2.json"));
    }

    @Test
    public void testInvalidBomFormat() throws Exception {
        Assert.assertFalse(isValidJson(CycloneDxSchema.Version.VERSION_12, "/invalid-bomformat-1.2.json"));
    }

    @Test
    public void testInvalidEmptyComponent() throws Exception {
        Assert.assertFalse(isValidJson(CycloneDxSchema.Version.VERSION_12, "/invalid-empty-component-1.2.json"));
    }

    @Test
    public void testValidEmptyComponents() throws Exception {
        Assert.assertTrue(isValidJson(CycloneDxSchema.Version.VERSION_12, "/valid-empty-components-1.2.json"));
    }

    @Test
    public void testMinimalViable() throws Exception {
        Assert.assertTrue(isValidJson(CycloneDxSchema.Version.VERSION_12, "/valid-minimal-viable-1.2.json"));
    }

    @Test
    public void testInvalidComponentType() throws Exception {
        Assert.assertFalse(isValidJson(CycloneDxSchema.Version.VERSION_12, "/invalid-component-type-1.2.json"));
    }

    @Test
    public void testMissingComponentType() throws Exception {
        Assert.assertFalse(isValidJson(CycloneDxSchema.Version.VERSION_12, "/invalid-missing-component-type-1.2.json"));
    }

    @Test
    public void testInvalidScope() throws Exception {
        Assert.assertFalse(isValidJson(CycloneDxSchema.Version.VERSION_12, "/invalid-scope-1.2.json"));
    }

    @Test
    public void testInvalidHashAlg() throws Exception {
        Assert.assertFalse(isValidJson(CycloneDxSchema.Version.VERSION_12, "/invalid-hash-alg-1.2.json"));
    }

    @Test
    public void testInvalidHashMd5() throws Exception {
        Assert.assertFalse(isValidJson(CycloneDxSchema.Version.VERSION_12, "/invalid-hash-md5-1.2.json"));
    }

    @Test
    public void testInvalidHashSha1() throws Exception {
        Assert.assertFalse(isValidJson(CycloneDxSchema.Version.VERSION_12, "/invalid-hash-sha1-1.2.json"));
    }

    @Test
    public void testInvalidHashSha256() throws Exception {
        Assert.assertFalse(isValidJson(CycloneDxSchema.Version.VERSION_12, "/invalid-hash-sha256-1.2.json"));
    }

    @Test
    public void testHashSha512() throws Exception {
        Assert.assertFalse(isValidJson(CycloneDxSchema.Version.VERSION_12, "/invalid-hash-sha512-1.2.json"));
    }
/*
    @Test
    public void testInvalidLicenseId() throws Exception { // TODO
        Assert.assertFalse(isValidJson(CycloneDxSchema.Version.VERSION_12, "/invalid-license-id-1.1.json"));
    }
*/
    @Test
    public void testInvalidEncoding() throws Exception {
        Assert.assertFalse(isValidJson(CycloneDxSchema.Version.VERSION_12, "/invalid-license-encoding-1.2.json"));
    }
/*
    @Test
    public void testValidLicenseId() throws Exception {
        Assert.assertTrue(isValidJson(CycloneDxSchema.Version.VERSION_12, "/valid-license-id-1.1.json"));
    }

    @Test
    public void testValidLicenseName() throws Exception {
        Assert.assertTrue(isValidJson(CycloneDxSchema.Version.VERSION_12, "/valid-license-name-1.1.json"));
    }

    @Test
    public void testValidLicenseExpression() throws Exception {
        Assert.assertTrue(isValidJson(CycloneDxSchema.Version.VERSION_12, "/valid-license-expression-1.1.json"));
    }

    @Test
    public void testInvalidLicenseChoice() throws Exception {
        Assert.assertFalse(isValidJson(CycloneDxSchema.Version.VERSION_12, "/invalid-license-choice-1.1.json"));
    }

    @Test
    public void testInvalidLicenseIdCount() throws Exception {
        Assert.assertFalse(isValidJson(CycloneDxSchema.Version.VERSION_12, "/invalid-license-id-count-1.1.json"));
    }

    @Test
    public void testInvalidLicenseNameCount() throws Exception {
        Assert.assertFalse(isValidJson(CycloneDxSchema.Version.VERSION_12, "/invalid-license-name-count-1.1.json"));
    }

    @Test
    public void testValidComponentRef() throws Exception {
        Assert.assertTrue(isValidJson(CycloneDxSchema.Version.VERSION_12, "/valid-component-ref-1.1.json"));
    }

    @Test
    public void testInvalidComponentRef() throws Exception {
        Assert.assertFalse(isValidJson(CycloneDxSchema.Version.VERSION_12, "/invalid-component-ref-1.1.json"));
    }

    @Test
    public void testValidXmlSignature() throws Exception {
        // NOTE: Doesn't actually validate XML Signature. That is a business-case detail, not an
        // implementation requirement. If the business case requires signature validation, it should
        // be performed after document validation.
        Assert.assertTrue(isValidJson(CycloneDxSchema.Version.VERSION_12, "/valid-xml-signature-1.1.json"));
    }
*/
    @Test
    public void testValidMetadataAuthors() throws Exception {
        Assert.assertTrue(isValidJson(CycloneDxSchema.Version.VERSION_12, "/valid-metadata-author-1.2.json"));
    }

    @Test
    public void testValidMetadataManufacture() throws Exception {
        Assert.assertTrue(isValidJson(CycloneDxSchema.Version.VERSION_12, "/valid-metadata-manufacture-1.2.json"));
    }

    @Test
    public void testValidMetadataSupplier() throws Exception {
        Assert.assertTrue(isValidJson(CycloneDxSchema.Version.VERSION_12, "/valid-metadata-supplier-1.2.json"));
    }

    @Test
    public void testValidMetadataTimestamp() throws Exception {
        Assert.assertTrue(isValidJson(CycloneDxSchema.Version.VERSION_12, "/valid-metadata-timestamp-1.2.json"));
    }

    @Test
    public void testInValidMetadataTimestamp() throws Exception {
        Assert.assertFalse(isValidJson(CycloneDxSchema.Version.VERSION_12, "/invalid-metadata-timestamp-1.2.json"));
    }

    @Test
    public void testValidMetadataTool() throws Exception {
        Assert.assertTrue(isValidJson(CycloneDxSchema.Version.VERSION_12, "/valid-metadata-tool-1.2.json"));
    }

    @Test
    public void testValidDependency() throws Exception {
        Assert.assertTrue(isValidJson(CycloneDxSchema.Version.VERSION_12, "/valid-dependency-1.2.json"));
    }

    @Test
    public void testInValidDependency() throws Exception {
        Assert.assertFalse(isValidJson(CycloneDxSchema.Version.VERSION_12, "/invalid-dependency-1.2.json"));
    }

    @Test
    public void testValidSwid() throws Exception {
        Assert.assertTrue(isValidJson(CycloneDxSchema.Version.VERSION_12, "/valid-component-swid-1.2.json"));
    }

    @Test
    public void testValidSwidFull() throws Exception {
        Assert.assertTrue(isValidJson(CycloneDxSchema.Version.VERSION_12, "/valid-component-swid-full-1.2.json"));
    }

    @Test
    public void testInValidSwid() throws Exception {
        Assert.assertFalse(isValidJson(CycloneDxSchema.Version.VERSION_12, "/invalid-component-swid-1.2.json"));
    }

    @Test
    public void testValidComponentType12() throws Exception {
        Assert.assertTrue(isValidJson(CycloneDxSchema.Version.VERSION_12, "/valid-component-types-1.2.json"));
    }

    private boolean isValidJson(CycloneDxSchema.Version version, String resource) throws Exception {
        final File file = new File(this.getClass().getResource(resource).getFile());
        final BomParser parser = new BomParser();
        return parser.isValidJson(file, version);
/*
        try {
            final String jsonString = FileUtils.readFileToString(file, StandardCharsets.UTF_8);
            parser.getJsonSchema(version).validate(new JSONObject(jsonString));
            return true;
        } catch (ValidationException e) {
            e.printStackTrace();
            return false;
        }
*/
    }
}
