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

import org.apache.commons.io.IOUtils;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public abstract class BaseSchemaVerificationTest {

    List<String> getAllResources() throws Exception {
        final List<String> files = new ArrayList<>();
        files.addAll(getResources("1.0/"));
        files.addAll(getResources("1.1/"));
        files.addAll(getResources("1.2/"));
        files.addAll(getResources("1.3/"));
        files.addAll(getResources("1.4/"));
        files.addAll(getResources("1.5/"));
        files.addAll(getResources("1.6/"));
        return files;
    }

    List<String> getResources(final String resourceDirectory) throws Exception {
        final List<String> files = new ArrayList<>();
        String dir = resourceDirectory;
        if (!resourceDirectory.endsWith("/")) {
            dir += "/";
        }
        try (InputStream in = this.getClass().getClassLoader().getResourceAsStream(dir)) {
            if (in != null) {
                files.addAll(IOUtils.readLines(in, StandardCharsets.UTF_8));
            }
        }
        return files;
    }
}
