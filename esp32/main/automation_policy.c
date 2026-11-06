// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#include "automation_policy.h"
#include "schedule_policy.h"
#include <math.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static double number(const cJSON *o, const char *k, double fallback) {
    const cJSON *v = cJSON_GetObjectItemCaseSensitive(o, k);
    return cJSON_IsNumber(v) && isfinite(v->valuedouble) ? v->valuedouble : fallback;
}
static bool flag(const cJSON *o, const char *k) { return cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(o, k)); }
cJSON *sc_rules_default(void) {
    return cJSON_Parse(
        "{\"enabled\":false,\"paused\":false,\"pause_until\":0,\"follow_dispatch\":true,\"charge_price_enabled\":false,"
        "\"charge_price_p\":7,\"discharge_price_enabled\":false,\"discharge_price_p\":30,\"weekly_charge\":false,"
        "\"charge_start\":1410,\"charge_end\":330,\"charge_days\":127,\"weekly_discharge\":false,\"discharge_start\":"
        "960,\"discharge_end\":1140,\"discharge_days\":127,\"target_soc\":80,\"charge_soc_enabled\":false,\"dispatch_soc_enabled\":false,"
        "\"dispatch_soc\":80,\"min_soc\":11,\"power_w\":5000,\"auto_resume\":false,\"octopus_seconds\":60,\"foxess_"
        "seconds\":600,\"history_days\":14,\"history_flash_enabled\":false,\"pause_discharge_dispatch\":true,\"discharge_overrides_charge\":true}");
}
bool sc_rules_valid(const cJSON *o) {
    cJSON *defaults = sc_rules_default();
    if (!cJSON_IsObject(o) || !defaults) {
        cJSON_Delete(defaults);
        return false;
    }
    bool valid = cJSON_GetArraySize(o) == cJSON_GetArraySize(defaults);
    const cJSON *item;
    cJSON_ArrayForEach(item, o) {
        const cJSON *def = cJSON_GetObjectItemCaseSensitive(defaults, item->string);
        if (!def || (cJSON_IsBool(def) ? !cJSON_IsBool(item) : !cJSON_IsNumber(item) || !isfinite(item->valuedouble)))
            valid = false;
        for (const cJSON *other = item->next; other; other = other->next)
            if (!strcmp(item->string, other->string))
                valid = false;
    }
    const char *percent[] = {"target_soc", "dispatch_soc", "min_soc"};
    for (unsigned i = 0; i < 3; i++)
        if (number(o, percent[i], -1) < 10 || number(o, percent[i], 101) > 100 ||
            floor(number(o, percent[i], -1)) != number(o, percent[i], -1))
            valid = false;
    if (number(o, "min_soc", 0) < 11 || number(o, "min_soc", 0) > number(o, "target_soc", 0) || number(o, "min_soc", 0) > number(o, "dispatch_soc", 0))
        valid = false;
    const char *minutes[] = {"charge_start", "charge_end", "discharge_start", "discharge_end"};
    for (unsigned i = 0; i < 4; i++) {
        double n = number(o, minutes[i], -1);
        if (n < 0 || n > 1439 || floor(n) != n)
            valid = false;
    }
    const char *days[] = {"charge_days", "discharge_days"};
    for (unsigned i = 0; i < 2; i++) {
        double n = number(o, days[i], -1);
        if (n < 1 || n > 127 || floor(n) != n)
            valid = false;
    }
    if (number(o, "charge_price_p", -1000) < -100 || number(o, "charge_price_p", 1001) > 1000 ||
        number(o, "discharge_price_p", -1000) < -100 || number(o, "discharge_price_p", 1001) > 1000)
        valid = false;
    if (number(o, "power_w", 0) < 100 || number(o, "power_w", 20001) > 20000 || number(o, "octopus_seconds", 0) < 60 ||
        number(o, "octopus_seconds", 3601) > 3600 || number(o, "foxess_seconds", 0) < 60 ||
        number(o, "foxess_seconds", 3601) > 3600 || number(o, "history_days", 0) < 1 ||
        number(o, "history_days", 61) > 60 || number(o, "pause_until", -1) < 0)
        valid = false;
    cJSON_Delete(defaults);
    return valid;
}
// Gregorian civil date to UTC, independent of the host timezone.
time_t sc_timestamp(const char *s) {
    // Kraken also returns SQL-style datetimes. Preserve the explicit UTC offset.
    char normalized[64];
    if (!s || strlen(s) < 20 || strlen(s) >= sizeof(normalized)) return 0;
    strcpy(normalized, s);
    if (normalized[10] == ' ') normalized[10] = 'T';
    s = normalized;
    int y, m, d, h, n, sec = 0, count = 0;
    if (!s || sscanf(s, "%4d-%2d-%2dT%2d:%2d:%2d%n", &y, &m, &d, &h, &n, &sec, &count) != 6 || y < 2020 || y > 2100 ||
        m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || h < 0 || n > 59 || n < 0 || sec < 0 || sec > 59)
        return 0;
    const char *tz = s + count;
    if (*tz == '.') {
        tz++;
        if (*tz < '0' || *tz > '9')
            return 0;
        while (*tz >= '0' && *tz <= '9')
            tz++;
    }
    static const int days_in_month[] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
    int days = days_in_month[m - 1] + (m == 2 && y % 4 == 0 && (y % 100 != 0 || y % 400 == 0));
    if (d > days)
        return 0;
    int offset = 0;
    if (*tz == 'Z' && !tz[1])
        offset = 0;
    else if ((*tz == '+' || *tz == '-') && strlen(tz) == 6 && tz[3] == ':') {
        int oh, on;
        if (sscanf(tz + 1, "%2d:%2d", &oh, &on) != 2 || oh < 0 || oh > 14 || on < 0 || on > 59)
            return 0;
        offset = (oh * 60 + on) * 60 * (*tz == '+' ? 1 : -1);
    } else
        return 0;
    int adjusted = y - (m <= 2), era = adjusted / 400;
    unsigned yo = adjusted - era * 400;
    unsigned doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1, doe = yo * 365 + yo / 4 - yo / 100 + doy;
    return (time_t)((int64_t)(era * 146097 + (int)doe - 719468) * 86400 + h * 3600 + n * 60 + sec - offset);
}
bool sc_dispatch_valid(const cJSON *rows) {
    if (!cJSON_IsArray(rows) || cJSON_GetArraySize(rows) > 96)
        return false;
    const cJSON *row;
    cJSON_ArrayForEach(row, rows) {
        const cJSON *a = cJSON_GetObjectItemCaseSensitive(row, "startDt"),
                    *b = cJSON_GetObjectItemCaseSensitive(row, "endDt");
        time_t start = cJSON_IsString(a) ? sc_timestamp(a->valuestring) : 0,
               end = cJSON_IsString(b) ? sc_timestamp(b->valuestring) : 0;
        if (!start || end <= start || end - start > 86400)
            return false;
    }
    return true;
}
typedef struct {
    unsigned char mode, soc, priority;
} cell_t;
static void fill(cell_t *cells, int start, int end, int mode, int soc, int priority) {
    for (int i = start; i < end; i++)
        if (priority >= cells[i].priority)
            cells[i] = (cell_t){mode, soc, priority};
}
static bool same(cell_t a, cell_t b) { return a.mode == b.mode && a.soc == b.soc && a.priority == b.priority; }
static void project(cell_t *cells, time_t start, time_t end, time_t now, int mode, int soc, int priority) {
    if (end <= now || start >= now + 86400 || end <= start)
        return;
    struct tm base;
    localtime_r(&now, &base);
    base.tm_hour = 0;
    base.tm_min = 0;
    base.tm_sec = 0;
    base.tm_isdst = -1;
    for (int day = 0; day <= 1; day++) {
        struct tm from = base;
        from.tm_mday += day;
        time_t day_start = mktime(&from);
        struct tm next = from;
        next.tm_mday++;
        next.tm_isdst = -1;
        time_t day_end = mktime(&next);
        time_t a = start > day_start ? start : day_start, b = end < day_end ? end : day_end;
        if (day && b > now + 86400)
            b = now + 86400;
        if (b <= a || b <= now)
            continue;
        struct tm local_a, local_b;
        localtime_r(&a, &local_a);
        localtime_r(&b, &local_b);
        int first = local_a.tm_hour * 60 + local_a.tm_min,
            last = b == day_end ? 1440 : local_b.tm_hour * 60 + local_b.tm_min;
        if (first < last)
            fill(cells, first, last, mode, soc, priority);
    }
}
static void weekly_periods(cell_t *cells, const cJSON *rules, const char *prefix, const struct tm *today, time_t now,
                           int mode, int target) {
    char key[32];
    snprintf(key, sizeof(key), "%s_start", prefix);
    int start = number(rules, key, 0);
    snprintf(key, sizeof(key), "%s_end", prefix);
    int end = number(rules, key, 0);
    snprintf(key, sizeof(key), "%s_days", prefix);
    int days = number(rules, key, 0);
    if (start == end)
        return;
    for (int day = -1; day <= 1; day++) {
        struct tm from = *today;
        from.tm_mday += day;
        from.tm_hour = start / 60;
        from.tm_min = start % 60;
        from.tm_sec = 0;
        from.tm_isdst = -1;
        time_t a = mktime(&from);
        if (!(days & (1 << from.tm_wday)))
            continue;
        struct tm to = from;
        to.tm_hour = end / 60;
        to.tm_min = end % 60;
        to.tm_sec = 0;
        to.tm_isdst = -1;
        if (end <= start)
            to.tm_mday++;
        time_t b = mktime(&to);
        project(cells, a, b, now, mode, target, 1);
    }
}
static void priced_periods(cell_t *cells, const cJSON *rates, time_t now, double threshold, bool upper, int mode,
                           int target) {
    const cJSON *row;
    cJSON_ArrayForEach(row, rates) {
        double value = number(row, "value", NAN);
        if (!isfinite(value) || (upper ? value < threshold : value > threshold))
            continue;
        time_t a = number(row, "start", 0), b = number(row, "end", 0);
        if (a > 0 && b > a)
            project(cells, a, b, now, mode, target, 1);
    }
}
cJSON *sc_automation_plan(const cJSON *rules, const cJSON *dispatches, const cJSON *imports, const cJSON *exports,
                          const cJSON *manual, time_t now, double soc) {
    if (!sc_rules_valid(rules) || !sc_dispatch_valid(dispatches))
        return NULL;
    cell_t *cells = calloc(1440, sizeof(*cells));
    if (!cells)
        return NULL;
    struct tm today;
    localtime_r(&now, &today);
    int current = today.tm_hour * 60 + today.tm_min;
    if (flag(rules, "charge_price_enabled"))
        priced_periods(cells, imports, now, number(rules, "charge_price_p", 7), false, 1,
                       (flag(rules, "charge_soc_enabled") ? number(rules, "target_soc", 80) : 100));
    if (flag(rules, "weekly_charge"))
        weekly_periods(cells, rules, "charge", &today, now, 1, (flag(rules, "charge_soc_enabled") ? number(rules, "target_soc", 80) : 100));
    // A manual period is temporary, and Smart Dispatch still has priority.
    if (number(manual, "expires", 0) > now) {
        int a = number(manual, "start", -1), b = number(manual, "end", -1), mode = number(manual, "mode", 0);
        if (a >= 0 && a < 1440 && b >= 0 && b < 1440 && a != b && mode >= 0 && mode <= 2) {
            if (a < b)
                fill(cells, a, b, mode, mode == 2 ? number(rules, "min_soc", 11) : (flag(rules, "charge_soc_enabled") ? number(rules, "target_soc", 80) : 100), 2);
            else {
                fill(cells, a, 1440, mode, mode == 2 ? number(rules, "min_soc", 11) : (flag(rules, "charge_soc_enabled") ? number(rules, "target_soc", 80) : 100),
                     2);
                fill(cells, 0, b, mode, mode == 2 ? number(rules, "min_soc", 11) : (flag(rules, "charge_soc_enabled") ? number(rules, "target_soc", 80) : 100), 2);
            }
        }
    }
    const cJSON *row;
    if (flag(rules, "follow_dispatch"))
        cJSON_ArrayForEach(row, dispatches) {
            time_t start = sc_timestamp(cJSON_GetObjectItemCaseSensitive(row, "startDt")->valuestring),
                   end = sc_timestamp(cJSON_GetObjectItemCaseSensitive(row, "endDt")->valuestring);
            start = (start / 1800) * 1800;
            end = ((end + 1799) / 1800) * 1800;
            if (end <= now || start > now + 86400)
                continue;
            project(cells, start, end, now, 1,
                    flag(rules, "dispatch_soc_enabled") ? number(rules, "dispatch_soc", 100) : 100, 3);
        }
    // Match the Pi resolver: discharging replaces ordinary charging by default,
    // while the two explicit safeguard preferences control charge conflicts.
    cell_t *discharge = calloc(1440, sizeof(*discharge));
    if (!discharge) { free(cells); return NULL; }
    if (flag(rules, "weekly_discharge"))
        weekly_periods(discharge, rules, "discharge", &today, now, 2, number(rules, "min_soc", 11));
    if (flag(rules, "discharge_price_enabled"))
        priced_periods(discharge, exports, now, number(rules, "discharge_price_p", 30), true, 2, number(rules, "min_soc", 11));
    for (int i = 0; i < 1440; i++) if (discharge[i].mode && cells[i].priority != 2) {
        bool protect = cells[i].mode == 1 &&
            ((cells[i].priority == 3 && flag(rules, "pause_discharge_dispatch")) || !flag(rules, "discharge_overrides_charge"));
        if (!protect) cells[i] = discharge[i];
    }
    free(discharge);
    // Auto-Resume affects only the active ordinary charge block.
    if (flag(rules, "auto_resume") && isfinite(soc) && cells[current].mode == 1 && cells[current].priority < 3 &&
        soc >= cells[current].soc) {
        cell_t active = cells[current];
        int a = current, b = current + 1;
        while (a > 0 && same(cells[a - 1], active))
            a--;
        while (b < 1440 && same(cells[b], active))
            b++;
        for (int i = a; i < b; i++)
            cells[i] = (cell_t){0};
    }
    cJSON *out = cJSON_CreateObject(), *all = cJSON_CreateArray(), *groups = cJSON_CreateArray();
    int dispatch_count = 0;
    if (!out || !all || !groups) {
        free(cells);
        cJSON_Delete(out);
        cJSON_Delete(all);
        cJSON_Delete(groups);
        return NULL;
    }
    for (int from = 0; from < 1440;) {
        int end = from + 1;
        while (end < 1440 && cells[from].mode == cells[end].mode && cells[from].soc == cells[end].soc)
            end++;
        cell_t cell = cells[from];
        for (int i = from + 1; i < end; i++)
            if (cells[i].priority > cell.priority)
                cell.priority = cells[i].priority;
        if (cell.mode) {
            cJSON *g = cJSON_CreateObject();
            bool complete = g && cJSON_AddNumberToObject(g, "enable", 1) &&
                            cJSON_AddNumberToObject(g, "startHour", from / 60) &&
                            cJSON_AddNumberToObject(g, "startMinute", from % 60) &&
                            cJSON_AddNumberToObject(g, "endHour", end == 1440 ? 23 : end / 60) &&
                            cJSON_AddNumberToObject(g, "endMinute", end == 1440 ? 59 : end % 60) &&
                            cJSON_AddStringToObject(g, "workMode", cell.mode == 1 ? "ForceCharge" : "ForceDischarge");
            cJSON *extra = complete ? cJSON_AddObjectToObject(g, "extraParam") : NULL;
            complete = complete && extra &&
                       cJSON_AddNumberToObject(extra, "minSocOnGrid", number(rules, "min_soc", 11)) &&
                       cJSON_AddNumberToObject(extra, "fdPwr", number(rules, "power_w", 5000)) &&
                       cJSON_AddNumberToObject(extra, "fdSoc", cell.soc) &&
                       cJSON_AddNumberToObject(g, "priority", cell.priority);
            if (!complete || !cJSON_AddItemToArray(all, g)) {
                cJSON_Delete(g);
                goto allocation_failed;
            }
            if (cell.priority == 3)
                dispatch_count++;
        }
        from = end;
    }
    int total = cJSON_GetArraySize(all);
    // Smart Dispatch first, then active and upcoming ordinary periods.
    for (int priority = 3; priority >= 1; priority--)
        for (int pass = 0; pass < 1440; pass++) {
            int at = (current + pass) % 1440;
            const cJSON *g;
            cJSON_ArrayForEach(g, all) {
                int a = number(g, "startHour", 0) * 60 + number(g, "startMinute", 0),
                    b = number(g, "endHour", 0) * 60 + number(g, "endMinute", 0);
                if (b == 1439)
                    b = 1440;
                if ((pass > 0 && a <= current && current < b) || number(g, "priority", 0) != priority ||
                    !(pass == 0 ? (a <= current && current < b) : a == at) || cJSON_GetArraySize(groups) >= 5)
                    continue;
                cJSON *copy = cJSON_Duplicate(g, true);
                if (!copy)
                    goto allocation_failed;
                cJSON_DeleteItemFromObjectCaseSensitive(copy, "priority");
                if (!cJSON_AddItemToArray(groups, copy)) {
                    cJSON_Delete(copy);
                    goto allocation_failed;
                }
            }
        }
    if (!cJSON_AddItemToObject(out, "groups", groups))
        goto allocation_failed;
    groups = NULL;
    time_t tomorrow = now + 86400;
    struct tm next;
    localtime_r(&tomorrow, &next);
    if (!cJSON_AddBoolToObject(out, "partial", total > 5) ||
        !cJSON_AddBoolToObject(out, "dispatch_capacity_exceeded", dispatch_count > 5) ||
        !cJSON_AddBoolToObject(out, "clock_transition_unsupported", today.tm_isdst != next.tm_isdst) ||
        !cJSON_AddNumberToObject(out, "total_periods", total))
        goto allocation_failed;
    cJSON_Delete(all);
    free(cells);
    return out;
allocation_failed:
    cJSON_Delete(out);
    cJSON_Delete(all);
    cJSON_Delete(groups);
    free(cells);
    return NULL;
}
static int param(const cJSON *g, const char *key) {
    const cJSON *v = cJSON_GetObjectItemCaseSensitive(cJSON_GetObjectItemCaseSensitive(g, "extraParam"), key);
    if (!cJSON_IsNumber(v))
        v = cJSON_GetObjectItemCaseSensitive(g, key);
    return cJSON_IsNumber(v) ? v->valueint : -1;
}
bool sc_plan_matches(const cJSON *wanted, const cJSON *actual) {
    if (!cJSON_IsArray(wanted) || !cJSON_IsArray(actual))
        return false;
    int active = 0;
    const cJSON *g;
    cJSON_ArrayForEach(g, actual) if (sc_schedule_group_enabled(g)) active++;
    if (active != cJSON_GetArraySize(wanted))
        return false;
    cJSON_ArrayForEach(g, wanted) {
        bool found = false;
        const cJSON *other;
        cJSON_ArrayForEach(other, actual) {
            if (!sc_schedule_group_enabled(other))
                continue;
            const cJSON *a = cJSON_GetObjectItemCaseSensitive(g, "workMode"),
                        *b = cJSON_GetObjectItemCaseSensitive(other, "workMode");
            if (!cJSON_IsString(a) || !cJSON_IsString(b) || strcmp(a->valuestring, b->valuestring))
                continue;
            bool equal = true;
            const char *keys[] = {"startHour", "startMinute", "endHour", "endMinute"};
            for (unsigned i = 0; i < 4; i++)
                if (number(g, keys[i], -1) != number(other, keys[i], -2))
                    equal = false;
            const char *params[] = {"fdSoc", "minSocOnGrid", "fdPwr"};
            for (unsigned i = 0; i < 3; i++)
                if (param(g, params[i]) != param(other, params[i]))
                    equal = false;
            if (equal)
                found = true;
        }
        if (!found)
            return false;
    }
    return true;
}
