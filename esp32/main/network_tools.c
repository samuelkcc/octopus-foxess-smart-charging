// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#include <stdio.h>
#include <string.h>
#include <sys/time.h>
#include <unistd.h>
#include "network_tools.h"
#include "provision_policy.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "lwip/etharp.h"
#include "lwip/netif.h"
#include "lwip/sockets.h"
#include "esp_timer.h"

static void add_ip(cJSON *out,const char *name,const esp_ip4_addr_t *ip){
    char text[16];snprintf(text,sizeof(text),IPSTR,IP2STR(ip));cJSON_AddStringToObject(out,name,text);
}
cJSON *sc_network_info(esp_netif_t *station){
    esp_netif_ip_info_t info={0};esp_netif_dns_info_t dns={0};
    cJSON *result=cJSON_CreateObject();
    bool valid=esp_netif_get_ip_info(station,&info)==ESP_OK&&info.ip.addr!=0;
    cJSON_AddBoolToObject(result,"connected",valid);
    if(valid){
        add_ip(result,"ip",&info.ip);add_ip(result,"gateway",&info.gw);add_ip(result,"netmask",&info.netmask);
        if(esp_netif_get_dns_info(station,ESP_NETIF_DNS_MAIN,&dns)==ESP_OK&&dns.ip.type==ESP_IPADDR_TYPE_V4)add_ip(result,"dns",&dns.ip.u_addr.ip4);
    }
    return result;
}
typedef struct{int index;ip4_addr_t target;bool send,occupied,complete;} arp_probe_t;
static esp_err_t arp_callback(void *arg){
    arp_probe_t *probe=arg;struct netif *netif=netif_get_by_index((u8_t)probe->index);
    if(!netif||!netif_is_up(netif)||!netif_is_link_up(netif))return ESP_FAIL;
    struct eth_addr *ethernet;const ip4_addr_t *ip;
    if(etharp_find_addr(netif,&probe->target,&ethernet,&ip)>=0)probe->occupied=true;
    probe->complete=!probe->send||etharp_request(netif,&probe->target)==ERR_OK;
    return probe->complete?ESP_OK:ESP_FAIL;
}
static uint16_t checksum(const unsigned char *bytes,size_t size){
    uint32_t sum=0;for(size_t i=0;i+1<size;i+=2)sum+=((uint16_t)bytes[i]<<8)|bytes[i+1];
    if(size&1)sum+=(uint16_t)bytes[size-1]<<8;
    while(sum>>16)sum=(sum&0xffff)+(sum>>16);
    return (uint16_t)~sum;
}
static int ping_once(const esp_ip4_addr_t *address){
    int socket_fd=socket(AF_INET,SOCK_RAW,IPPROTO_ICMP);if(socket_fd<0)return -1;
    struct timeval timeout={.tv_sec=0,.tv_usec=600000};
    if(setsockopt(socket_fd,SOL_SOCKET,SO_RCVTIMEO,&timeout,sizeof(timeout))<0){close(socket_fd);return -1;}
    uint16_t sequence=(uint16_t)(esp_timer_get_time()&0xffff);
    unsigned char packet[8]={8,0,0,0,0x53,0x43,(unsigned char)(sequence>>8),(unsigned char)sequence};
    uint16_t sum=checksum(packet,sizeof(packet));packet[2]=sum>>8;packet[3]=sum&255;
    struct sockaddr_in target={.sin_family=AF_INET,.sin_addr.s_addr=address->addr};
    if(sendto(socket_fd,packet,sizeof(packet),0,(struct sockaddr *)&target,sizeof(target))!=(int)sizeof(packet)){close(socket_fd);return -1;}
    int found=0;unsigned char response[512];int64_t deadline=esp_timer_get_time()+700000;
    while(esp_timer_get_time()<deadline){
        struct sockaddr_in source;socklen_t length=sizeof(source);
        int bytes=recvfrom(socket_fd,response,sizeof(response),0,(struct sockaddr *)&source,&length);
        if(bytes<0)break;
        size_t offset=bytes>0?(response[0]&15)*4:0;
        if(offset>=20&&bytes>=(int)offset+8&&source.sin_addr.s_addr==address->addr&&response[offset]==0&&
            response[offset+4]==0x53&&response[offset+5]==0x43&&response[offset+6]==packet[6]&&response[offset+7]==packet[7]){found=1;break;}
    }
    close(socket_fd);return found;
}
int sc_probe_ip(esp_netif_t *station,const esp_ip4_addr_t *address){
    esp_netif_ip_info_t info={0};
    if(esp_netif_get_ip_info(station,&info)!=ESP_OK||!info.ip.addr||!address||
        (address->addr&info.netmask.addr)!=(info.ip.addr&info.netmask.addr))return -1;
    if(address->addr==info.ip.addr)return 0;
    arp_probe_t probe={.index=esp_netif_get_netif_impl_index(station),.target.addr=address->addr,.send=true};
    if(esp_netif_tcpip_exec(arp_callback,&probe)!=ESP_OK)return -1;
    if(probe.occupied)return 1;
    vTaskDelay(pdMS_TO_TICKS(250));
    int ping=ping_once(address);probe.send=false;
    if(esp_netif_tcpip_exec(arp_callback,&probe)!=ESP_OK)return -1;
    if(probe.occupied||ping==1)return 1;
    return ping<0?-1:0;
}
cJSON *sc_suggest_ip(esp_netif_t *station){
    esp_netif_ip_info_t info={0};esp_netif_dns_info_t dns={0};
    cJSON *out=cJSON_CreateObject();
    if(esp_netif_get_ip_info(station,&info)!=ESP_OK||!info.ip.addr){cJSON_AddStringToObject(out,"status","Test the Wi-Fi connection with DHCP first");return out;}
    esp_netif_get_dns_info(station,ESP_NETIF_DNS_MAIN,&dns);
    uint32_t candidates[16];
    size_t count=sc_ip_candidates(ntohl(info.ip.addr),ntohl(info.netmask.addr),ntohl(info.gw.addr),
        dns.ip.type==ESP_IPADDR_TYPE_V4?ntohl(dns.ip.u_addr.ip4.addr):0,candidates,16);
    cJSON *checked=cJSON_AddArrayToObject(out,"checked");
    for(size_t i=0;i<count;i++){
        esp_ip4_addr_t ip={.addr=htonl(candidates[i])};int result=sc_probe_ip(station,&ip);
        cJSON *row=cJSON_CreateObject();add_ip(row,"ip",&ip);
        cJSON_AddStringToObject(row,"result",result>0?"in_use":result==0?"no_response_detected":"probe_failed");cJSON_AddItemToArray(checked,row);
        if(result==0){add_ip(out,"candidate",&ip);cJSON_AddStringToObject(out,"status","No response detected by ARP and ping. Verify the router DHCP pool before using this address.");break;}
        if(result<0){cJSON_AddStringToObject(out,"status","The probe could not complete; no address was suggested");return out;}
    }
    if(!cJSON_GetObjectItemCaseSensitive(out,"candidate"))cJSON_AddStringToObject(out,"status","No candidate found in this bounded scan. Use DHCP reservation or a reviewed manual address.");
    cJSON_AddItemToObject(out,"network",sc_network_info(station));
    cJSON_AddBoolToObject(out,"router_pool_review_required",true);return out;
}
