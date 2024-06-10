package org.cyclonedx.schema;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;

import org.w3c.dom.Document;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;
import org.xml.sax.SAXException;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;

import java.io.InputStream;
import java.io.IOException;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.DynamicTest.dynamicTest;

public class XmlCatalogVerificationTest {

    /**
     * Tests the XML catalog by parsing the xmlcatalog.xml file and checking if the namespaces
     * in the XSD schema files match the namespaces defined in the xmlcatalog.xml file.
     *
     * @return  a list of dynamic tests for each URI in the xmlcatalog.xml file
     * @throws IOException                  if an I/O error occurs while reading the XML catalog file
     * @throws ParserConfigurationException if a parser configuration error occurs
     * @throws SAXException                 if a SAX error occurs while parsing the XML catalog file
     */
    @TestFactory
    public List<DynamicTest> testXmlCatalog() throws IOException, ParserConfigurationException, SAXException {
        // Define the path to the XML catalog file
        String xmlCatalogFilename = "xmlcatalog.xml";

        // Load the XML catalog file from the classpath
        ClassLoader classLoader = getClass().getClassLoader();
        InputStream xmlCatalogStream = classLoader.getResourceAsStream(xmlCatalogFilename);

        Assertions.assertNotNull(xmlCatalogStream, "XML catalog file not found");

        // Parse the xmlcatalog.xml file
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        DocumentBuilder builder = factory.newDocumentBuilder();
        Document xmlCatalogDocument = builder.parse(new InputSource(xmlCatalogStream));

        // Get the XML catalog elements
        NodeList xmlCatalogElements = xmlCatalogDocument.getDocumentElement().getChildNodes();

        // List to hold dynamic tests
        List<DynamicTest> dynamicTests = new ArrayList<>();

        // Iterate through the XML catalog elements
        for (int i = 0; i < xmlCatalogElements.getLength(); i++) {
            Node xmlCatalogElement = xmlCatalogElements.item(i);
            if (xmlCatalogElement.getNodeName().equals("uri")) {
                String uriName = xmlCatalogElement.getAttributes().getNamedItem("name").getTextContent();
                String xsdLocalFilename = xmlCatalogElement.getAttributes().getNamedItem("uri").getTextContent();

                // Create a dynamic test for each URI
                dynamicTests.add(dynamicTest("Testing URI: " + uriName, () -> {
                    // Load the XSD schema file from the classpath
                    InputStream xsdSchemaFileStream = classLoader.getResourceAsStream(xsdLocalFilename);
                    Assertions.assertNotNull(xsdSchemaFileStream, "The following file is missing: " + xsdLocalFilename);

                    // Read the XSD local file content
                    String xsdContent = new String(xsdSchemaFileStream.readAllBytes(), StandardCharsets.UTF_8);

                    // Parse the XSD file content to a Document object
                    Document xsdDocument = builder.parse(new InputSource(new StringReader(xsdContent)));

                    // Check if the XSD document contains the expected namespace
                    NodeList schemaNodes = xsdDocument.getElementsByTagNameNS("*", "schema");
                    boolean namespaceFound = false;
                    for (int j = 0; j < schemaNodes.getLength(); j++) {
                        Node schemaNode = schemaNodes.item(j);
                        String targetNamespace = schemaNode.getAttributes().getNamedItem("targetNamespace").getTextContent();
                        System.out.println("uriName.equals(targetNamespace)" + uriName.equals(targetNamespace));
                        if (uriName.equals(targetNamespace)) {
                            namespaceFound = true;
                            break;
                        }
                    }
                    assertTrue(namespaceFound, "The namespace " + uriName + " is not present in file " + xsdLocalFilename);
                }));
            }
        }

        return dynamicTests;
    }
}
