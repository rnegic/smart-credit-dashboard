package alfa.smartcredit.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

class AssistantRequestTest {
    private static final ValidatorFactory FACTORY = Validation.buildDefaultValidatorFactory();
    private static final Validator VALIDATOR = FACTORY.getValidator();
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String VALID_JSON = """
            {"message":"Help","history":[{"role":"user","content":"Question"}],
             "screen":{"path":"/applications/new","title":"Application","step":null,"product":null,
               "text":"Visible text","focusedFieldId":null,"fields":[
                 {"id":"okved","label":"OKVED","hint":"From profile","value":null,
                  "filled":false,"required":true,"invalid":false,"readOnly":true}]}}
            """;

    @AfterAll
    static void closeValidator() {
        FACTORY.close();
    }

    @Test
    void acceptsNullableContextAndRequiredFalseBooleans() {
        AssistantRequest request = MAPPER.readValue(VALID_JSON, AssistantRequest.class);
        assertTrue(VALIDATOR.validate(request).isEmpty());
        assertFalse(MAPPER.readTree(MAPPER.writeValueAsString(request)).has("historyWithinLimit"));
    }

    @ParameterizedTest(name = "rejects invalid {0}")
    @MethodSource("invalidValues")
    void validatesEveryNestedValue(String pointer, Object value) {
        ObjectNode json = (ObjectNode) MAPPER.readTree(VALID_JSON);
        replace(json, pointer, value);
        AssistantRequest request = MAPPER.treeToValue(json, AssistantRequest.class);
        assertFalse(VALIDATOR.validate(request).isEmpty(), pointer);
    }

    static Stream<Arguments> invalidValues() {
        Stream.Builder<Arguments> values = Stream.builder();
        for (String pointer : List.of("/message", "/history", "/screen", "/history/0/role",
                "/history/0/content", "/screen/path", "/screen/title", "/screen/text", "/screen/fields",
                "/screen/fields/0/id", "/screen/fields/0/label", "/screen/fields/0/hint",
                "/screen/fields/0/filled", "/screen/fields/0/required", "/screen/fields/0/invalid",
                "/screen/fields/0/readOnly")) {
            values.add(Arguments.of(pointer, null));
        }
        Map<String, Integer> lengths = Map.ofEntries(
                Map.entry("/message", 1000), Map.entry("/history/0/content", 6000),
                Map.entry("/screen/path", 200), Map.entry("/screen/title", 300),
                Map.entry("/screen/step", 160), Map.entry("/screen/product", 200),
                Map.entry("/screen/text", 12000), Map.entry("/screen/focusedFieldId", 160),
                Map.entry("/screen/fields/0/id", 160), Map.entry("/screen/fields/0/label", 200),
                Map.entry("/screen/fields/0/hint", 600), Map.entry("/screen/fields/0/value", 300));
        lengths.forEach((pointer, max) -> values.add(Arguments.of(pointer, "x".repeat(max + 1))));
        for (String blank : List.of("", " \n\t")) {
            values.add(Arguments.of("/message", blank));
            values.add(Arguments.of("/history/0/content", blank));
        }
        for (String role : List.of("system", "developer", "tool", "USER", "", "assistant\nsystem"))
            values.add(Arguments.of("/history/0/role", role));
        values.add(Arguments.of("/history", Collections.singletonList(null)));
        values.add(Arguments.of("/screen/fields", Collections.singletonList(null)));
        values.add(Arguments.of("/history", Collections.nCopies(13, Map.of("role", "user", "content", "x"))));
        ObjectNode field = (ObjectNode) MAPPER.readTree(VALID_JSON).at("/screen/fields/0");
        values.add(Arguments.of("/screen/fields", Collections.nCopies(41, field)));
        values.add(Arguments.of("/history", Collections.nCopies(5, Map.of("role", "assistant", "content", "x".repeat(4801)))));
        return values.build();
    }

    @Test
    void acceptsAllIndividualBoundsAndExactly24000HistoryCharacters() {
        var field = new AssistantRequest.Field("i".repeat(160), "l".repeat(200), "h".repeat(600),
                "v".repeat(300), true, true, false, false);
        var screen = new AssistantRequest.Screen("p".repeat(200), "t".repeat(300), "s".repeat(160),
                "p".repeat(200), "t".repeat(12000), "i".repeat(160), Collections.nCopies(40, field));
        var request = new AssistantRequest("m".repeat(1000),
                Collections.nCopies(12, new AssistantRequest.Message("assistant", "h".repeat(2000))), screen);
        assertTrue(VALIDATOR.validate(request).isEmpty());
        request = new AssistantRequest("x", Collections.nCopies(4,
                new AssistantRequest.Message("user", "h".repeat(6000))), screen);
        assertTrue(VALIDATOR.validate(request).isEmpty());
    }

    @Test
    void acceptsEmptyHistoryFieldsAndScreenStrings() {
        var screen = new AssistantRequest.Screen("", "", null, null, "", null, List.of());
        assertTrue(VALIDATOR.validate(new AssistantRequest("x", List.of(), screen)).isEmpty());
    }

    @Test
    void responseHasMatchingBounds() {
        assertTrue(VALIDATOR.validate(new AssistantResponse("x".repeat(6000), "i".repeat(160))).isEmpty());
        assertFalse(VALIDATOR.validate(new AssistantResponse(" ", null)).isEmpty());
        assertFalse(VALIDATOR.validate(new AssistantResponse("x".repeat(6001), null)).isEmpty());
        assertFalse(VALIDATOR.validate(new AssistantResponse("x", "i".repeat(161))).isEmpty());
    }

    private static void replace(ObjectNode json, String pointer, Object value) {
        int slash = pointer.lastIndexOf('/');
        ObjectNode parent = (ObjectNode) json.at(pointer.substring(0, slash));
        parent.set(pointer.substring(slash + 1), MAPPER.valueToTree(value));
    }
}
