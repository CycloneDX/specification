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
package org.cyclonedx.tools;

import com.mashape.unirest.http.HttpResponse;
import com.mashape.unirest.http.JsonNode;
import com.mashape.unirest.http.Unirest;
import com.mashape.unirest.http.exceptions.UnirestException;
import org.apache.commons.io.FileUtils;
import org.apache.commons.text.StringEscapeUtils;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public class SpdxXsdGenerator {

    public static void main(String[] args) throws Exception {
        String tagName = args.length == 0 || Objects.equals(args[0], "latest")
                ? getLatestReleaseTagName()
                : args[0];
        new SpdxXsdGenerator(tagName)
                .generateSchemas();
    }

    private static final String REPO = "spdx/license-list-data";

    private static String getLatestReleaseTagName() throws Exception {
        String apiReleasesLatest = "https://api.github.com/repos/" + REPO + "/releases/latest";
        HttpResponse<JsonNode> apiResponse = Unirest.get(apiReleasesLatest).asJson();
        final JSONObject apiResponseRoot = apiResponse.getBody().getObject();
        return apiResponseRoot.getString("tag_name");
    }

    private final String tagName;

    public SpdxXsdGenerator(String tagName) {
        this.tagName = tagName;
    }

    public void generateSchemas() throws Exception {
        System.out.println("Generate Schemas for " + REPO + " tagName: " + tagName);

        String licenseUrl = "https://raw.githubusercontent.com/" + REPO + "/" + tagName + "/json/licenses.json";
        String exceptionsUrl = "https://raw.githubusercontent.com/" + REPO +  "/" + tagName + "/json/exceptions.json";

        HttpResponse<JsonNode> licenseResponse = Unirest.get(licenseUrl).asJson();
        final JSONObject licenseRoot = licenseResponse.getBody().getObject();

        HttpResponse<JsonNode> exceptionResponse = Unirest.get(exceptionsUrl).asJson();
        final JSONObject exceptionRoot = exceptionResponse.getBody().getObject();

        JSONArray licenses = licenseRoot.getJSONArray("licenses");
        Map<String, String> licenseMap = new LinkedHashMap<>();
        for (int i = 0; i < licenses.length(); i++) {
            JSONObject license = licenses.getJSONObject(i);
            licenseMap.put(license.getString("licenseId"), license.getString("name"));
        }

        JSONArray exceptions = exceptionRoot.getJSONArray("exceptions");
        Map<String, String> exceptionMap = new LinkedHashMap<>();
        for (int i = 0; i < exceptions.length(); i++) {
            JSONObject license = exceptions.getJSONObject(i);
            exceptionMap.put(license.getString("licenseExceptionId"), license.getString("name"));
        }

        createXmlSchema(licenseMap, exceptionMap);
        createJsonSchema(licenseMap, exceptionMap);
    }

    private void createXmlSchema(Map<String, String> licenses, Map<String, String> exceptions) throws IOException {
        StringBuilder sb = new StringBuilder();
        sb
            .append("<?xml version=\"1.0\" encoding=\"utf-8\"?>").append("\n")
            .append("<xs:schema xmlns:xs=\"http://www.w3.org/2001/XMLSchema\"").append("\n")
            .append(indent(11)).append("elementFormDefault=\"qualified\"").append("\n")
            .append(indent(11)).append("targetNamespace=\"http://cyclonedx.org/schema/spdx\"").append("\n")
            .append(indent(11)).append("version=\"1.0-" + stripLeadingV(tagName) + "\">").append("\n\n")
            .append(indent(4)).append("<xs:simpleType name=\"licenseId\">").append("\n")
            .append(indent(8)).append("<xs:restriction base=\"xs:string\">").append("\n");

        sb.append(indent(12)).append("<!-- Licenses -->").append("\n");
        addLicenseAsXml(sb, licenses.entrySet());
        sb.append(indent(12)).append("<!-- Exceptions -->").append("\n");
        addLicenseAsXml(sb, exceptions.entrySet());

        sb
            .append(indent(8)).append("</xs:restriction>").append("\n")
            .append(indent(4)).append("</xs:simpleType>").append("\n").append("\n")
            .append("</xs:schema>");

        String filePath = System.getProperty("cdx.schema.dir") + "/spdx.xsd";
        System.out.println("Write SPDX xml schema to: " + filePath);
        File file = new File(filePath);
        FileUtils.writeStringToFile(file, sb.toString(), StandardCharsets.UTF_8);
    }

    private void createJsonSchema(Map<String, String> licenses, Map<String, String> exceptions) throws IOException {
        StringBuilder sb = new StringBuilder();
        sb
                .append("{").append("\n")
                .append(indent(2)).append("\"$schema\": \"http://json-schema.org/draft-07/schema#\",").append("\n")
                .append(indent(2)).append("\"$id\": \"http://cyclonedx.org/schema/spdx.schema.json\",").append("\n")
                .append(indent(2)).append("\"$comment\": \"v1.0-" + stripLeadingV(tagName) + "\",").append("\n")
                .append(indent(2)).append("\"type\": \"string\",").append("\n")
                .append(indent(2)).append("\"enum\": [");

        addLicenseAsJson(sb, licenses.entrySet());
        sb.append(",");
        addLicenseAsJson(sb, exceptions.entrySet());

        sb
                .append("\n").append(indent(2)).append("]").append("\n")
                .append("}").append("\n");

        String filePath = System.getProperty("cdx.schema.dir") + "/spdx.schema.json";
        System.out.println("Write SPDX json schema to: " + filePath);
        File file = new File(filePath);
        FileUtils.writeStringToFile(file, sb.toString(), StandardCharsets.UTF_8);
    }

    private static void addLicenseAsXml(StringBuilder sb, Set<Map.Entry<String, String>> set) {
        for (Map.Entry<String, String> license : set) {
            sb.append(indent(12)).append("<xs:enumeration value=\"").append(license.getKey()).append("\">").append("\n");
            sb.append(indent(16)).append("<xs:annotation>").append("\n");
            sb.append(indent(20)).append("<xs:documentation>").append(StringEscapeUtils.escapeXml10(license.getValue())).append("</xs:documentation>").append("\n");
            sb.append(indent(16)).append("</xs:annotation>").append("\n");
            sb.append(indent(12)).append("</xs:enumeration>").append("\n");
        }
    }

    private static void addLicenseAsJson(StringBuilder sb, Set<Map.Entry<String, String>> set) {
        int i = 0;
        for (Map.Entry<String, String> license : set) {
            sb.append("\n");
            sb.append(indent(4)).append("\"").append(license.getKey()).append("\"");
            if (i < set.size()-1) {
                sb.append(",");
            }
            i++;
        }
    }

    private static String indent(int spaces) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < spaces; i++) {
            sb.append(" ");
        }
        return sb.toString();
    }

    public static String stripLeadingV(String input) {
        if (input != null && input.length() > 1 && input.charAt(0) == 'v' ) {
            return input.substring(1);
        }
        return input;
    }
}
