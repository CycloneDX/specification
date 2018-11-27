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
import org.apache.commons.io.FileUtils;
import org.apache.commons.text.StringEscapeUtils;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

public class SpdxXsdGenerator {

    private static final String SPDX_VERSION = "3.3";

    public static void main(String args[]) throws Exception {

        //todo : make configurable
        String licenseUrl = "https://raw.githubusercontent.com/spdx/license-list-data/v" + SPDX_VERSION + "/json/licenses.json";
        String exceptionsUrl = "https://raw.githubusercontent.com/spdx/license-list-data/v" + SPDX_VERSION + "/json/exceptions.json";

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

        createSchema(licenseMap, exceptionMap);
        createLicenseListJson(licenseMap, exceptionMap);
    }


    private static void createSchema(Map<String, String> licenses, Map<String, String> exceptions) throws IOException {
        StringBuilder sb = new StringBuilder();
        sb
            .append("<?xml version=\"1.0\" encoding=\"utf-8\"?>").append("\n")
            .append("<xs:schema xmlns:xs=\"http://www.w3.org/2001/XMLSchema\"").append("\n")
            .append(indent(11)).append("elementFormDefault=\"qualified\"").append("\n")
            .append(indent(11)).append("targetNamespace=\"http://cyclonedx.org/schema/spdx\"").append("\n")
            .append(indent(11)).append("version=\"1.0-" + SPDX_VERSION + "\">").append("\n\n")
            .append(indent(4)).append("<xs:simpleType name=\"licenseId\">").append("\n")
            .append(indent(8)).append("<xs:restriction base=\"xs:string\">").append("\n");

        sb.append(indent(12)).append("<!-- Licenses -->").append("\n");
        addLicense(sb, licenses.entrySet());
        sb.append(indent(12)).append("<!-- Exceptions -->").append("\n");
        addLicense(sb, exceptions.entrySet());

        sb
            .append(indent(8)).append("</xs:restriction>").append("\n")
            .append(indent(4)).append("</xs:simpleType>").append("\n").append("\n")
            .append("</xs:schema>");

        //todo : make configurable
        File file = new File("/Users/steve/Development/CycloneDX/specification/schema/spdx.xsd");
        FileUtils.writeStringToFile(file, sb.toString(), StandardCharsets.UTF_8);
    }

    private static void createLicenseListJson(Map<String, String> licenses, Map<String, String> exceptions) throws IOException {
        StringBuilder sb = new StringBuilder();
        sb.append("[").append("\n");
        for (Map.Entry<String, String> license : licenses.entrySet()) {
            sb.append("\"").append(license.getKey()).append("\"").append(",").append("\n");
        }
        for (Map.Entry<String, String> license : exceptions.entrySet()) {
            sb.append("\"").append(license.getKey()).append("\"").append(",").append("\n");
        }
        sb.delete(sb.length() - 2, sb.length());
        sb.append("\n").append("]").append("\n");

        //todo : make configurable
        File file = new File("/Users/steve/Development/CycloneDX/cyclonedx-node-module/spdx-licenses.json");
        FileUtils.writeStringToFile(file, sb.toString(), StandardCharsets.UTF_8);
    }

    private static void addLicense(StringBuilder sb, Set<Map.Entry<String, String>> set) {
        for (Map.Entry<String, String> license : set) {
            sb.append(indent(12)).append("<xs:enumeration value=\"").append(license.getKey()).append("\">").append("\n");
            sb.append(indent(16)).append("<xs:annotation>").append("\n");
            sb.append(indent(20)).append("<xs:documentation>").append(StringEscapeUtils.escapeXml10(license.getValue())).append("</xs:documentation>").append("\n");
            sb.append(indent(16)).append("</xs:annotation>").append("\n");
            sb.append(indent(12)).append("</xs:enumeration>").append("\n");
        }
    }

    private static String indent(int spaces) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < spaces; i++) {
            sb.append(" ");
        }
        return sb.toString();
    }

}
