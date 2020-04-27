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

import org.cyclonedx.BomParser;
import org.cyclonedx.CycloneDxSchema;
import org.junit.Assert;
import org.junit.Test;
import java.io.File;

public class SchemaVerificationTest {

    @Test
    public void testValid_10() throws Exception {
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_10, "/bom-1.0.xml"));
    }

    @Test
    public void testValid_11() throws Exception {
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_11, "/bom-1.1.xml"));
    }

    @Test
    public void testValid_12() throws Exception {
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_12, "/bom-1.2.xml"));
    }

    @Test
    public void testInvalidSerialNumber() throws Exception {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-serialnumber-1.1.xml"));
    }

    @Test
    public void testInvalidNamespace() throws Exception {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-namespace-1.1.xml"));
    }

    @Test
    public void testValidRandomAttributes() throws Exception {
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_11, "/valid-random-attributes-1.1.xml"));
    }

    @Test
    public void testInvalidEmptyComponent() throws Exception {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-empty-component-1.1.xml"));
    }

    @Test
    public void testValidEmptyComponents() throws Exception {
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_11, "/valid-empty-components-1.1.xml"));
    }

    @Test
    public void testMinimalViable() throws Exception {
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_11, "/valid-minimal-viable-1.1.xml"));
    }

    @Test
    public void testInvalidComponentType() throws Exception {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-component-type-1.1.xml"));
    }

    @Test
    public void testMissingComponentType() throws Exception {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-missing-component-type-1.1.xml"));
    }

    @Test
    public void testInvalidScope() throws Exception {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-scope-1.1.xml"));
    }

    @Test
    public void testInvalidHashAlg() throws Exception {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-hash-alg-1.1.xml"));
    }

    @Test
    public void testInvalidHashMd5() throws Exception {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-hash-md5-1.1.xml"));
    }

    @Test
    public void testInvalidHashSha1() throws Exception {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-hash-sha1-1.1.xml"));
    }

    @Test
    public void testInvalidHashSha256() throws Exception {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-hash-sha256-1.1.xml"));
    }

    @Test
    public void testHashSha512() throws Exception {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-hash-sha512-1.1.xml"));
    }

    @Test
    public void testInvalidLicenseId() throws Exception {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-license-id-1.1.xml"));
    }

    @Test
    public void testInvalidEncoding() throws Exception {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-license-encoding-1.1.xml"));
    }

    @Test
    public void testValidLicenseId() throws Exception {
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_11, "/valid-license-id-1.1.xml"));
    }

    @Test
    public void testValidLicenseName() throws Exception {
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_11, "/valid-license-name-1.1.xml"));
    }

    @Test
    public void testValidLicenseExpression() throws Exception {
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_11, "/valid-license-expression-1.1.xml"));
    }

    @Test
    public void testInvalidLicenseChoice() throws Exception {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-license-choice-1.1.xml"));
    }

    @Test
    public void testInvalidLicenseIdCount() throws Exception {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-license-id-count-1.1.xml"));
    }

    @Test
    public void testInvalidLicenseNameCount() throws Exception {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-license-name-count-1.1.xml"));
    }

    @Test
    public void testValidComponentRef() throws Exception {
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_11, "/valid-component-ref-1.1.xml"));
    }

    @Test
    public void testInvalidComponentRef() throws Exception {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-component-ref-1.1.xml"));
    }

    @Test
    public void testValidExternalElements() throws Exception {
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_11, "/valid-external-elements-1.1.xml"));
    }

    @Test
    public void testValidXmlSignature() throws Exception {
        // NOTE: Doesn't actually validate XML Signature. That is a business-case detail, not an
        // implementation requirement. If the business case requires signature validation, it should
        // be performed after document validation.
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_11, "/valid-xml-signature-1.1.xml"));
    }

    @Test
    public void testValidMetadataAuthors() throws Exception {
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_12, "/valid-metadata-author-1.2.xml"));
    }

    @Test
    public void testValidMetadataManufacture() throws Exception {
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_12, "/valid-metadata-manufacture-1.2.xml"));
    }

    @Test
    public void testValidMetadataSupplier() throws Exception {
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_12, "/valid-metadata-supplier-1.2.xml"));
    }

    @Test
    public void testValidMetadataTimestamp() throws Exception {
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_12, "/valid-metadata-timestamp-1.2.xml"));
    }

    @Test
    public void testInValidMetadataTimestamp() throws Exception {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_12, "/invalid-metadata-timestamp-1.2.xml"));
    }

    @Test
    public void testValidMetadataTool() throws Exception {
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_12, "/valid-metadata-tool-1.2.xml"));
    }

    @Test
    public void testValidDependency() throws Exception {
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_12, "/valid-dependency-1.2.xml"));
    }

    @Test
    public void testInValidDependency() throws Exception {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_12, "/invalid-dependency-1.2.xml"));
    }

    private boolean isValid(CycloneDxSchema.Version version, String resource) throws Exception {
        final File file = new File(this.getClass().getResource(resource).getFile());
        final BomParser parser = new BomParser();
        return parser.isValid(file, version);
    }
}
