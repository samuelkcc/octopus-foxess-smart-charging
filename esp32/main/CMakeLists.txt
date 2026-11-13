# Bluetooth must remain disabled in this Wi-Fi/USB firmware.
if(CONFIG_BT_ENABLED)
  message(FATAL_ERROR "Smart Charging ESP32 requires CONFIG_BT_ENABLED=n")
endif()
idf_component_register(SRCS "wifi_reconnect.c" "debug_log.c" "debug_http.c" "ota_update.c" "ota_policy.c" "dashboard_port.c" "main.c" "config_store.c" "config_access.c" "foxess_schedule.c" "schedule_policy.c" "schedule_transaction.c" "provision_policy.c" "network_tools.c" "automation_policy.c" "cloud_read.c" "runtime.c" "dashboard_http.c" "history_store.c" "history_flash.c" "foxess_live.c" "foxess_live_store.c" "foxess_live_policy.c" "service_setup.c"
  INCLUDE_DIRS "."
  REQUIRES app_update tcp_transport esp_partition esp_wifi esp_netif esp_event esp_http_client esp_http_server esp_psram spi_flash nvs_flash mbedtls json driver lwip esp_timer
  EMBED_TXTFILES "../../LICENSE" "../../THIRD_PARTY_NOTICES.md" "../SDK_NOTICES.txt")

find_program(SC_NODE node REQUIRED)
execute_process(COMMAND ${SC_NODE} ${CMAKE_CURRENT_LIST_DIR}/../../scripts/build-esp32-dashboard.mjs RESULT_VARIABLE SC_UI_RESULT)
if(NOT SC_UI_RESULT EQUAL 0)
  message(FATAL_ERROR "ESP32 dashboard bundle failed")
endif()
file(GLOB SC_UI_SOURCES CONFIGURE_DEPENDS "${CMAKE_CURRENT_LIST_DIR}/../dashboard/*" "${CMAKE_CURRENT_LIST_DIR}/../dashboard/vendor/*" "${CMAKE_CURRENT_LIST_DIR}/../../src/price-display.js" "${CMAKE_CURRENT_LIST_DIR}/../../dev/*.js" "${CMAKE_CURRENT_LIST_DIR}/../../dev/ui.css" "${CMAKE_CURRENT_LIST_DIR}/../../dev/guide.css" "${CMAKE_CURRENT_LIST_DIR}/../../docs/USER-GUIDE.md" "${CMAKE_CURRENT_LIST_DIR}/../../src/styles.css")
set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS ${SC_UI_SOURCES} "${CMAKE_CURRENT_LIST_DIR}/../../scripts/build-esp32-dashboard.mjs")
target_add_binary_data(${COMPONENT_LIB} "${CMAKE_CURRENT_LIST_DIR}/../../.build/esp32-ui/dashboard.html.gz" BINARY)

foreach(SC_ICON apple-touch-icon icon-192 icon-512)
  target_add_binary_data(${COMPONENT_LIB} "${CMAKE_CURRENT_LIST_DIR}/../../src/icons/${SC_ICON}.png" BINARY)
endforeach()
