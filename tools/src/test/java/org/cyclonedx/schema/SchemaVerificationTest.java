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
    public void testExamples() {
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_10, "/bom-1.0.xml"));
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_11, "/bom-1.1.xml"));
    }

    @Test
    public void testInvalidSerialNumber() {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-serialnumber-1.1.xml"));
    }

    @Test
    public void testInvalidNamespace() {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-namespace-1.1.xml"));
    }

    @Test
    public void testValidRandomAttributes() {
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_11, "/valid-random-attributes-1.1.xml"));
    }

    @Test
    public void testInvalidEmptyComponent() {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-empty-component-1.1.xml"));
    }

    @Test
    public void testValidEmptyComponents() {
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_11, "/valid-empty-components-1.1.xml"));
    }

    @Test
    public void testMinimalViable() {
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_11, "/valid-minimal-viable-1.1.xml"));
    }

    @Test
    public void testInvalidComponentType() {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-component-type-1.1.xml"));
    }

    @Test
    public void testMissingComponentType() {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-missing-component-type-1.1.xml"));
    }

    @Test
    public void testInvalidScope() {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-scope-1.1.xml"));
    }

    @Test
    public void testInvalidHashAlg() {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-hash-alg-1.1.xml"));
    }

    @Test
    public void testInvalidHashMd5() {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-hash-md5-1.1.xml"));
    }

    @Test
    public void testInvalidHashSha1() {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-hash-sha1-1.1.xml"));
    }

    @Test
    public void testInvalidHashSha256() {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-hash-sha256-1.1.xml"));
    }

    @Test
    public void testHashSha512() {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-hash-sha512-1.1.xml"));
    }

    @Test
    public void testInvalidLicenseId() {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-license-id-1.1.xml"));
    }

    @Test
    public void testInvalidEncoding() {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-license-encoding-1.1.xml"));
    }

    @Test
    public void testValidLicenseId() {
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_11, "/valid-license-id-1.1.xml"));
    }

    @Test
    public void testValidLicenseName() {
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_11, "/valid-license-name-1.1.xml"));
    }

    @Test
    public void testValidLicenseExpression() {
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_11, "/valid-license-expression-1.1.xml"));
    }

    @Test
    public void testInvalidLicenseChoice() {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-license-choice-1.1.xml"));
    }

    @Test
    public void testInvalidLicenseIdCount() {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-license-id-count-1.1.xml"));
    }

    @Test
    public void testInvalidLicenseNameCount() {
        Assert.assertFalse(isValid(CycloneDxSchema.Version.VERSION_11, "/invalid-license-name-count-1.1.xml"));
    }
/*
    @Test
    public void test() {
    }

    @Test
    public void test() {
    }

    @Test
    public void test() {
    }

    @Test
    public void test() {
    }

    @Test
    public void test() {
    }

    @Test
    public void test() {
    }

    @Test
    public void test() {
    }

    @Test
    public void test() {
    }

    @Test
    public void test() {
    }

    @Test
    public void test() {
    }





      */

    @Test
    public void testValidXmlSignature() {
        Assert.assertTrue(isValid(CycloneDxSchema.Version.VERSION_11, "/valid-xml-signature-1.1.xml"));
    }

    private boolean isValid(CycloneDxSchema.Version version, String resource) {
        final File file = new File(this.getClass().getResource(resource).getFile());
        final BomParser parser = new BomParser();
        return parser.isValid(file, version);
    }
}
