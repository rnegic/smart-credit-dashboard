package alfa.smartcredit.service;

import alfa.smartcredit.exception.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class AiExtractionServiceTest {

    @Test
    void routerAiRequestUsesVersionedBaseUrlAndJsonBody() {
        var builder = RestClient.builder().baseUrl("https://routerai.ru/api/v1");
        var server = MockRestServiceServer.bindTo(builder).build();
        var service = new AiExtractionService(builder.build(), new ObjectMapper(),
                "test-only-key", "nvidia/nemotron-3.5-super-vl", "json_object");
        server.expect(requestTo("https://routerai.ru/api/v1/chat/completions"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer test-only-key"))
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.model").value("nvidia/nemotron-3.5-super-vl"))
                .andExpect(jsonPath("$.response_format.type").value("json_object"))
                .andRespond(withSuccess(envelope("{\"businessTask\":\"Закупка товара\",\"amount\":3000000,\"termMonths\":24,\"purpose\":\"Оборотные средства\"}"), MediaType.APPLICATION_JSON));

        var result = service.extract("Нужно 3 млн рублей на закупку товара на два года");

        assertEquals(new BigDecimal("3000000"), result.amount());
        assertEquals(24, result.termMonths());
        assertEquals("Оборотные средства", result.purpose());
        assertNull(result.monthlyRevenue());
        server.verify();
    }

    @Test
    void customProviderCanUseStrictSchemaOrBasicTextMode() {
        for (String mode : new String[]{"json_schema", "text"}) {
            var builder = RestClient.builder().baseUrl("http://localhost:11434/v1");
            var server = MockRestServiceServer.bindTo(builder).build();
            var service = new AiExtractionService(builder.build(), new ObjectMapper(), "test", "custom-model", mode);
            var expectation = server.expect(requestTo("http://localhost:11434/v1/chat/completions"))
                    .andExpect(jsonPath("$.model").value("custom-model"));
            if (mode.equals("json_schema")) {
                expectation.andExpect(jsonPath("$.response_format.json_schema.strict").value(true));
            } else {
                expectation.andExpect(jsonPath("$.response_format").doesNotExist());
            }
            expectation.andRespond(withSuccess(envelope("{}"), MediaType.APPLICATION_JSON));
            service.extract("Закупка товара");
            server.verify();
        }
    }

    @Test
    void invalidProviderResponsesBecomeBadGatewayInsteadOfInternalError() {
        for (String response : new String[]{"null", "{}", envelope("null"), envelope("[]"), envelope("not json")}) {
            var builder = RestClient.builder().baseUrl("https://provider.example/v1");
            var server = MockRestServiceServer.bindTo(builder).build();
            var service = new AiExtractionService(builder.build(), new ObjectMapper(), "test", "model", "json_object");
            server.expect(anything()).andRespond(withSuccess(response, MediaType.APPLICATION_JSON));
            var error = assertThrows(ApiException.class, () -> service.extract("Запрос"));
            assertEquals(HttpStatus.BAD_GATEWAY, error.getStatus());
            assertEquals("AI_BAD_RESPONSE", error.getCode());
            server.verify();
        }
    }

    @Test
    void providerRateLimitRemainsAnUnavailableError() {
        var builder = RestClient.builder().baseUrl("https://provider.example/v1");
        var server = MockRestServiceServer.bindTo(builder).build();
        var service = new AiExtractionService(builder.build(), new ObjectMapper(), "test", "model", "json_object");
        server.expect(anything()).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));
        var error = assertThrows(ApiException.class, () -> service.extract("Запрос"));
        assertEquals("AI_UNAVAILABLE", error.getCode());
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, error.getStatus());
        server.verify();
    }

    @Test
    void fractionalOrOverflowedTermIsNotSilentlyConvertedToMonths() {
        var builder = RestClient.builder().baseUrl("https://provider.example/v1");
        var server = MockRestServiceServer.bindTo(builder).build();
        var service = new AiExtractionService(builder.build(), new ObjectMapper(), "test", "model", "json_object");
        server.expect(anything()).andRespond(withSuccess(envelope("{\"termMonths\":24.5}"), MediaType.APPLICATION_JSON));
        assertNull(service.extract("Запрос").termMonths());
        server.verify();
    }

    @Test
    void missingKeyDoesNotSendANetworkRequest() {
        var service = new AiExtractionService(RestClient.create(), new ObjectMapper(), "", "model", "json_object");
        assertEquals("AI_UNAVAILABLE", assertThrows(ApiException.class, () -> service.extract("Запрос")).getCode());
    }

    private String envelope(String content) {
        return new ObjectMapper().writeValueAsString(java.util.Map.of("choices", java.util.List.of(
                java.util.Map.of("message", java.util.Map.of("content", content)))));
    }
}
