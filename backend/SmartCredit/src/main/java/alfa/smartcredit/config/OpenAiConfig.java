package alfa.smartcredit.config;

import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.core5.util.Timeout;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration
public class OpenAiConfig {

    @Bean("openAiRestClient")
    RestClient openAiRestClient(@Value("${app.openai.base-url}") String baseUrl) {
        // 1. Настраиваем таймауты для Apache HttpClient 5
        RequestConfig requestConfig = RequestConfig.custom()
                .setConnectTimeout(Timeout.ofSeconds(5))
                .setResponseTimeout(Timeout.ofSeconds(40))
                .build();

        // 2. Создаём сам HTTP-клиент
        var httpClient = HttpClients.custom()
                .setDefaultRequestConfig(requestConfig)
                .build();

        // 3. Оборачиваем его в фабрику Spring
        var requestFactory = new HttpComponentsClientHttpRequestFactory(httpClient);

        // 4. Собираем RestClient
        return RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();
    }
}
