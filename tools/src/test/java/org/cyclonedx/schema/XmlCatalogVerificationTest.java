package org.cyclonedx.schema;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;

import org.w3c.dom.Document;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;
import org.xml.sax.SAXException;

import javax.xml.namespace.NamespaceContext;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.xpath.XPath;
import javax.xml.xpath.XPathConstants;
import javax.xml.xpath.XPathExpressionException;
import javax.xml.xpath.XPathFactory;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

import static org.junit.jupiter.api.DynamicTest.dynamicTest;

public class XmlCatalogVerificationTest {

    /**
     * Tests the XML catalog by parsing the xmlcatalog.xml file and verifying if the XML namespaces
     * in the referenced XSD schema files match the XML namespaces defined in the xmlcatalog.xml file.
     *
     * @return a list of dynamic tests for each URI in the xmlcatalog.xml file
     * @throws IOException                  if an I/O error occurs while reading the XML catalog file
     * @throws ParserConfigurationException if a parser configuration error occurs
     * @throws SAXException                 if a SAX error occurs while parsing the XML catalog file
     * @throws XPathExpressionException     if an XPath expression error occurs
     */
    @TestFactory
    public List<DynamicTest> testXmlCatalog() throws IOException, ParserConfigurationException, SAXException, XPathExpressionException {
        // Define the path to the XML catalog file. This is relative to "${basedir}/../schema" in the pom.xml.
        String xmlCatalogFilename = "xmlcatalog.xml";

        // Load the XML catalog file from the classpath
        ClassLoader classLoader = getClass().getClassLoader();
        InputStream xmlCatalogStream = classLoader.getResourceAsStream(xmlCatalogFilename);

        // Ensure the XML catalog file is found
        Assertions.assertNotNull(xmlCatalogStream, "XML catalog file not found");

        // Parse the xmlcatalog.xml file
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);  // Make the factory namespace-aware
        DocumentBuilder builder = factory.newDocumentBuilder();
        Document xmlCatalogDocument = builder.parse(new InputSource(xmlCatalogStream));

        // Get the XML catalog elements
        NodeList xmlCatalogElements = xmlCatalogDocument.getDocumentElement().getChildNodes();

        // List to hold dynamic tests
        List<DynamicTest> dynamicTests = new ArrayList<>();

        // Iterate through the XML catalog elements
        for (int i = 0; i < xmlCatalogElements.getLength(); i++) {
            Node xmlCatalogElement = xmlCatalogElements.item(i);

            // Check if the element is a <uri> element, continue if it is not
            if (!xmlCatalogElement.getNodeName().equals("uri")) {
                continue;
            }

            // Get the URI name and the local filename of the XSD schema
            String uriNameXmlCtlg = xmlCatalogElement.getAttributes().getNamedItem("name").getTextContent();
            String xsdLocalFilename = xmlCatalogElement.getAttributes().getNamedItem("uri").getTextContent();

            // Load the XSD schema local file from the classpath
            InputStream xsdSchemaFileStream = classLoader.getResourceAsStream(xsdLocalFilename);
            Assertions.assertNotNull(xsdSchemaFileStream, "The following file is missing: " + xsdLocalFilename);

            // Parse the XSD schema local file
            DocumentBuilderFactory factoryXsd = DocumentBuilderFactory.newInstance();
            factoryXsd.setNamespaceAware(true);  // Make the factory namespace-aware
            DocumentBuilder builderXsd = factoryXsd.newDocumentBuilder();
            Document xsdDocument = builderXsd.parse(new InputSource(xsdSchemaFileStream));

            // Create an XPath instance to evaluate the targetNamespace field found in the XSD local schema file
            XPath xPath = XPathFactory.newInstance().newXPath();
            xPath.setNamespaceContext(new NamespaceContext() {
                @Override
                public String getNamespaceURI(String prefix) {
                    // Define the namespace URI for the xs prefix
                    if ("xs".equals(prefix)) {
                        return "http://www.w3.org/2001/XMLSchema";
                    }
                    return null;
                }

                @Override
                public String getPrefix(String namespaceURI) {
                    // Define the prefix for the namespace URI
                    if ("http://www.w3.org/2001/XMLSchema".equals(namespaceURI)) {
                        return "xs";
                    }
                    return null;
                }

                @Override
                public Iterator<String> getPrefixes(String namespaceURI) {
                    return null;
                }
            });

            // Evaluate the targetNamespace attribute from the XSD document
            String targetNamespace = (String) xPath.evaluate("/xs:schema/@targetNamespace", xsdDocument, XPathConstants.STRING);

            // Create a dynamic test for each URI
            dynamicTests.add(dynamicTest("Testing if URI namespace from the XML catalog: " + uriNameXmlCtlg + " matches the URI namespace from the local XSD file: " + targetNamespace, () -> {
                // Assert if the targetNamespace from the XSD file matches the uriNameXmlCtlg from the XML catalog
                Assertions.assertEquals(uriNameXmlCtlg, targetNamespace, "The namespace " + uriNameXmlCtlg + " does not match the targetNamespace in file " + xsdLocalFilename);
            }));
        }

        // Return the list of dynamic tests
        return dynamicTests;
    }
}
