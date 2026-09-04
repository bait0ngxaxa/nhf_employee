import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { isFeatureEnabled, FEATURE_KEYS } from "@/lib/ssot/features";
import { getLiffHomeModules } from "@/lib/line/liff-home";
import type { LiffHomeModules } from "@/lib/line/liff-types";
import { APP_ROUTES } from "@/lib/ssot/routes";

import {
    getLineConfigurationStatus,
    getLineLiffSessionConfig,
    getLineMessagingConfig,
} from "./config";
import { buildLiffUrl } from "./liff-links";
import { buildRoutineLiffUrl } from "@/modules/routine";

export const NHF_RICH_MENU_WIDTH = 2500;
export const NHF_RICH_MENU_HEIGHT = 843;
export const NHF_RICH_MENU_MAX_BYTES = 1_000_000;
export const NHF_RICH_MENU_IMAGE_PATH = "assets/line/nhf-rich-menu.png";

export const ROUTINE_RICH_MENU_WIDTH = 2500;
export const ROUTINE_RICH_MENU_HEIGHT = 843;
export const ROUTINE_RICH_MENU_MAX_BYTES = 1_000_000;
export const ROUTINE_RICH_MENU_IMAGE_PATH =
    "assets/line/routine-rich-menu.png";

const LINE_MESSAGING_API_URL = "https://api.line.me";
const LINE_MESSAGING_DATA_API_URL = "https://api-data.line.me";
const RICH_MENU_ID_PATTERN = /^richmenu-[A-Za-z0-9_-]{1,128}$/;

export interface RichMenuBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface RichMenuUriAction {
    type: "uri";
    label: string;
    uri: string;
}

export interface RoutineRichMenuDefinition {
    size: {
        width: number;
        height: number;
    };
    selected: boolean;
    name: string;
    chatBarText: string;
    areas: Array<{
        bounds: RichMenuBounds;
        action: RichMenuUriAction;
    }>;
}

export interface NhfRichMenuDefinition {
    size: {
        width: number;
        height: number;
    };
    selected: boolean;
    name: string;
    chatBarText: string;
    areas: Array<{
        bounds: RichMenuBounds;
        action: RichMenuUriAction;
    }>;
}

export type RichMenuProvisioningPhase =
    | "configuration"
    | "image"
    | "validate"
    | "create"
    | "upload"
    | "set-default"
    | "verify";

export class RichMenuProvisioningError extends Error {
    readonly phase: RichMenuProvisioningPhase;
    readonly statusCode: number | undefined;
    readonly richMenuId: string | undefined;

    constructor(
        phase: RichMenuProvisioningPhase,
        message: string,
        options: {
            statusCode?: number;
            richMenuId?: string;
        } = {},
    ) {
        super(message);
        this.name = "RichMenuProvisioningError";
        this.phase = phase;
        this.statusCode = options.statusCode;
        this.richMenuId = options.richMenuId;
    }
}

export interface RichMenuImageInfo {
    format: "png" | "jpeg";
    contentType: "image/png" | "image/jpeg";
    width: number;
    height: number;
    bytes: number;
}

export interface RoutineRichMenuPreparation {
    liffUrl: string;
    definition: RoutineRichMenuDefinition;
    imagePath: string;
    image: RichMenuImageInfo;
    routineFeatureEnabled: boolean;
    channelAccessToken: string;
}

export interface RoutineRichMenuProvisionResult {
    mode: "dry-run" | "applied";
    liffUrl: string;
    definition: RoutineRichMenuDefinition;
    imagePath: string;
    image: RichMenuImageInfo;
    routineFeatureEnabled: boolean;
    richMenuId?: string;
    verifiedDefaultRichMenuId?: string;
}

export interface RoutineRichMenuStatus {
    liffIdConfigured: boolean;
    loginChannelConfigured: boolean;
    channelAccessTokenConfigured: boolean;
    channelSecretConfigured: boolean;
    sessionSecretConfigured: boolean;
    sessionTtlConfigured: boolean;
    sessionConfigValid: boolean;
    routineFeatureEnabled: boolean;
    liffUrl: string | null;
    defaultRichMenuId: string | null;
    defaultRichMenuStatus:
        | "configured"
        | "not-set"
        | "managed-elsewhere"
        | "unavailable"
        | "not-checked";
    defaultRichMenuError: string | null;
}

export interface NhfRichMenuPreparation {
    liffUrls: {
        stock: string;
        leave: string;
        routine: string;
    };
    definition: NhfRichMenuDefinition;
    imagePath: string;
    image: RichMenuImageInfo;
    modules: LiffHomeModules;
    channelAccessToken: string;
}

export interface NhfRichMenuProvisionResult {
    mode: "dry-run" | "applied";
    liffUrls: NhfRichMenuPreparation["liffUrls"];
    definition: NhfRichMenuDefinition;
    imagePath: string;
    image: RichMenuImageInfo;
    modules: LiffHomeModules;
    richMenuId?: string;
    verifiedDefaultRichMenuId?: string;
}

export interface NhfRichMenuStatus {
    liffIdConfigured: boolean;
    loginChannelConfigured: boolean;
    channelAccessTokenConfigured: boolean;
    channelSecretConfigured: boolean;
    sessionSecretConfigured: boolean;
    sessionTtlConfigured: boolean;
    sessionConfigValid: boolean;
    modules: LiffHomeModules;
    liffUrls: NhfRichMenuPreparation["liffUrls"] | null;
    defaultRichMenuId: string | null;
    defaultRichMenuStatus: RoutineRichMenuStatus["defaultRichMenuStatus"];
    defaultRichMenuError: string | null;
}

export interface NhfRichMenuDefaultResult {
    mode: "dry-run" | "applied";
    richMenuId: string;
    verifiedDefaultRichMenuId?: string;
}

type FetchImplementation = typeof fetch;

function countCharacters(value: string): number {
    return Array.from(value).length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function redactSensitiveValues(
    value: string,
    sensitiveValues: readonly string[],
): string {
    return sensitiveValues.reduce(
        (redacted, sensitiveValue) => sensitiveValue
            ? redacted.split(sensitiveValue).join("[REDACTED]")
            : redacted,
        value,
    );
}

function getProviderErrorSummary(
    status: number,
    body: string,
    sensitiveValues: readonly string[] = [],
): string {
    try {
        const parsed: unknown = JSON.parse(body);
        if (isRecord(parsed) && typeof parsed.message === "string") {
            const message = redactSensitiveValues(
                parsed.message.trim(),
                sensitiveValues,
            ).slice(0, 200);
            if (message) return message;
        }
    } catch {
        // Use a generic status-only message when LINE doesn't return JSON.
    }

    return `LINE API returned HTTP ${status}`;
}

async function readResponseJson(response: Response): Promise<unknown> {
    const body = await response.text();
    if (!body.trim()) return null;

    try {
        return JSON.parse(body) as unknown;
    } catch {
        return null;
    }
}

async function requestLineApi(
    input: {
        phase: RichMenuProvisioningPhase;
        endpoint: string;
        channelAccessToken: string;
        method: "GET" | "POST";
        body?: BodyInit;
        contentType?: string;
        richMenuId?: string;
        fetchImpl: FetchImplementation;
    },
): Promise<unknown> {
    const headers: Record<string, string> = {
        Authorization: `Bearer ${input.channelAccessToken}`,
    };
    if (input.contentType) {
        headers["Content-Type"] = input.contentType;
    }

    let response: Response;
    try {
        response = await input.fetchImpl(input.endpoint, {
            method: input.method,
            headers,
            body: input.body,
        });
    } catch {
        throw new RichMenuProvisioningError(
            input.phase,
            "LINE Rich Menu API is unavailable",
            { richMenuId: input.richMenuId },
        );
    }

    if (!response.ok) {
        const responseBody = await response.text().catch(() => "");
        throw new RichMenuProvisioningError(
            input.phase,
            getProviderErrorSummary(response.status, responseBody, [
                input.channelAccessToken,
            ]),
            {
                statusCode: response.status,
                richMenuId: input.richMenuId,
            },
        );
    }

    return readResponseJson(response);
}

function validateLiffUrl(liffUrl: string, menuLabel = "Routine"): void {
    let parsed: URL;
    try {
        parsed = new URL(liffUrl);
    } catch {
        throw new RichMenuProvisioningError(
            "configuration",
            `${menuLabel} LIFF URL is invalid`,
        );
    }

    if (
        parsed.protocol !== "https:"
        || parsed.hostname !== "liff.line.me"
        || parsed.pathname.length <= 1
        || parsed.search
        || parsed.hash
    ) {
        throw new RichMenuProvisioningError(
            "configuration",
            `${menuLabel} LIFF URL must be a base https://liff.line.me URL`,
        );
    }
}

export function buildRoutineRichMenuDefinition(
    liffUrl = buildRoutineLiffUrl(),
): RoutineRichMenuDefinition {
    validateLiffUrl(liffUrl);

    return {
        size: {
            width: ROUTINE_RICH_MENU_WIDTH,
            height: ROUTINE_RICH_MENU_HEIGHT,
        },
        selected: true,
        name: "NHF Routine",
        chatBarText: "งานของฉัน",
        areas: [
            {
                bounds: {
                    x: 0,
                    y: 0,
                    width: ROUTINE_RICH_MENU_WIDTH,
                    height: ROUTINE_RICH_MENU_HEIGHT,
                },
                action: {
                    type: "uri",
                    label: "เปิดงาน Routine",
                    uri: liffUrl,
                },
            },
        ],
    };
}

export function validateRoutineRichMenuDefinition(
    definition: RoutineRichMenuDefinition,
): void {
    validateRichMenuDefinition(definition, "Routine Rich Menu");
}

function validateRichMenuDefinition(
    definition: RoutineRichMenuDefinition | NhfRichMenuDefinition,
    menuLabel: string,
): void {
    const { width, height } = definition.size;
    if (
        width < 800
        || width > 2500
        || height < 250
        || width / height < 1.45
    ) {
        throw new RichMenuProvisioningError(
            "configuration",
            "Rich Menu dimensions do not meet LINE requirements",
        );
    }

    if (
        !definition.name.trim()
        || countCharacters(definition.name) > 300
        || !definition.chatBarText.trim()
        || countCharacters(definition.chatBarText) > 14
        || definition.areas.length === 0
        || definition.areas.length > 20
    ) {
        throw new RichMenuProvisioningError(
            "configuration",
            "Rich Menu definition contains invalid text or areas",
        );
    }

    for (const area of definition.areas) {
        const { x, y, width: areaWidth, height: areaHeight } = area.bounds;
        if (
            x < 0
            || y < 0
            || areaWidth <= 0
            || areaHeight <= 0
            || x + areaWidth > width
            || y + areaHeight > height
        ) {
            throw new RichMenuProvisioningError(
                "configuration",
                "Rich Menu tappable area is outside the image bounds",
            );
        }

        if (area.action.type !== "uri") {
            throw new RichMenuProvisioningError(
                "configuration",
                `${menuLabel} must use a URI action`,
            );
        }
        validateLiffUrl(area.action.uri, menuLabel.replace(" Rich Menu", ""));
    }
}

export interface NhfRichMenuDestinations {
    stock?: string;
    leave?: string;
    routine?: string;
}

export function buildNhfRichMenuDefinition(
    destinations: NhfRichMenuDestinations = {},
): NhfRichMenuDefinition {
    const liffUrls = {
        stock: destinations.stock ?? buildLiffUrl(APP_ROUTES.line.stock),
        leave: destinations.leave ?? buildLiffUrl(APP_ROUTES.line.leave),
        routine: destinations.routine ?? buildLiffUrl(APP_ROUTES.line.routine),
    };
    const menuWidth = NHF_RICH_MENU_WIDTH;
    const firstAreaWidth = Math.floor(menuWidth / 3);
    const secondAreaWidth = firstAreaWidth;
    const thirdAreaWidth = menuWidth - firstAreaWidth - secondAreaWidth;

    const areas = [
        {
            bounds: {
                x: 0,
                y: 0,
                width: firstAreaWidth,
                height: NHF_RICH_MENU_HEIGHT,
            },
            action: {
                type: "uri" as const,
                label: "เบิกวัสดุ",
                uri: liffUrls.stock,
            },
        },
        {
            bounds: {
                x: firstAreaWidth,
                y: 0,
                width: secondAreaWidth,
                height: NHF_RICH_MENU_HEIGHT,
            },
            action: {
                type: "uri" as const,
                label: "ลางาน",
                uri: liffUrls.leave,
            },
        },
        {
            bounds: {
                x: firstAreaWidth + secondAreaWidth,
                y: 0,
                width: thirdAreaWidth,
                height: NHF_RICH_MENU_HEIGHT,
            },
            action: {
                type: "uri" as const,
                label: "งานของฉัน",
                uri: liffUrls.routine,
            },
        },
    ];

    const definition: NhfRichMenuDefinition = {
        size: {
            width: NHF_RICH_MENU_WIDTH,
            height: NHF_RICH_MENU_HEIGHT,
        },
        selected: true,
        name: "NHFapp",
        chatBarText: "เลือกบริการ",
        areas,
    };
    validateNhfRichMenuDefinition(definition);
    return definition;
}

export function validateNhfRichMenuDefinition(
    definition: NhfRichMenuDefinition,
): void {
    validateRichMenuDefinition(definition, "NHFapp Rich Menu");
}

export async function validateRoutineRichMenuImage(
    imagePath: string,
    options: {
        maxBytes?: number;
        expectedWidth?: number;
        expectedHeight?: number;
    } = {},
): Promise<RichMenuImageInfo> {
    const maxBytes = options.maxBytes ?? ROUTINE_RICH_MENU_MAX_BYTES;
    const expectedWidth = options.expectedWidth ?? ROUTINE_RICH_MENU_WIDTH;
    const expectedHeight = options.expectedHeight ?? ROUTINE_RICH_MENU_HEIGHT;

    let fileStats: Awaited<ReturnType<typeof stat>>;
    try {
        fileStats = await stat(imagePath);
    } catch {
        throw new RichMenuProvisioningError(
            "image",
            `Rich Menu image was not found: ${imagePath}`,
        );
    }

    if (!fileStats.isFile()) {
        throw new RichMenuProvisioningError(
            "image",
            "Rich Menu image path is not a file",
        );
    }
    if (fileStats.size > maxBytes) {
        throw new RichMenuProvisioningError(
            "image",
            "Rich Menu image exceeds LINE's 1 MB limit",
        );
    }

    let metadata: sharp.Metadata;
    try {
        metadata = await sharp(imagePath).metadata();
    } catch {
        throw new RichMenuProvisioningError(
            "image",
            "Rich Menu image is not a readable PNG or JPEG",
        );
    }

    const format = metadata.format === "png"
        ? "png"
        : metadata.format === "jpeg"
            ? "jpeg"
            : null;
    if (!format || !metadata.width || !metadata.height) {
        throw new RichMenuProvisioningError(
            "image",
            "Rich Menu image must be a PNG or JPEG with readable dimensions",
        );
    }
    if (metadata.width !== expectedWidth || metadata.height !== expectedHeight) {
        throw new RichMenuProvisioningError(
            "image",
            `Rich Menu image must be ${expectedWidth}x${expectedHeight}px`,
        );
    }

    return {
        format,
        contentType: format === "png" ? "image/png" : "image/jpeg",
        width: metadata.width,
        height: metadata.height,
        bytes: fileStats.size,
    };
}

export async function validateNhfRichMenuImage(
    imagePath: string,
): Promise<RichMenuImageInfo> {
    return validateRoutineRichMenuImage(imagePath, {
        maxBytes: NHF_RICH_MENU_MAX_BYTES,
        expectedWidth: NHF_RICH_MENU_WIDTH,
        expectedHeight: NHF_RICH_MENU_HEIGHT,
    });
}

export function getRoutineRichMenuImagePath(
    workingDirectory = process.cwd(),
): string {
    return path.resolve(workingDirectory, ROUTINE_RICH_MENU_IMAGE_PATH);
}

export function getNhfRichMenuImagePath(
    workingDirectory = process.cwd(),
): string {
    return path.resolve(workingDirectory, NHF_RICH_MENU_IMAGE_PATH);
}

export async function prepareRoutineRichMenu(
    imagePath = getRoutineRichMenuImagePath(),
): Promise<RoutineRichMenuPreparation & { imageBytes: Buffer }> {
    let channelAccessToken: string;
    try {
        ({ channelAccessToken } = getLineMessagingConfig());
    } catch {
        throw new RichMenuProvisioningError(
            "configuration",
            "NHFapp LINE channel access token is not configured",
        );
    }

    const liffUrl = buildRoutineLiffUrl();
    const definition = buildRoutineRichMenuDefinition(liffUrl);
    validateRoutineRichMenuDefinition(definition);
    const image = await validateRoutineRichMenuImage(imagePath);

    return {
        liffUrl,
        definition,
        imagePath,
        image,
        imageBytes: await readFile(imagePath),
        routineFeatureEnabled: isFeatureEnabled(FEATURE_KEYS.routine),
        channelAccessToken,
    };
}

export async function getRoutineRichMenuDefaultId(
    fetchImpl: FetchImplementation = fetch,
): Promise<string | null> {
    let channelAccessToken: string;
    try {
        ({ channelAccessToken } = getLineMessagingConfig());
    } catch {
        throw new RichMenuProvisioningError(
            "configuration",
            "NHFapp LINE channel access token is not configured",
        );
    }

    let response: Response;
    try {
        response = await fetchImpl(
            `${LINE_MESSAGING_API_URL}/v2/bot/user/all/richmenu`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${channelAccessToken}`,
                },
            },
        );
    } catch {
        throw new RichMenuProvisioningError(
            "verify",
            "LINE Rich Menu API is unavailable",
        );
    }

    if (response.status === 404) return null;
    if (!response.ok) {
        const responseBody = await response.text().catch(() => "");
        throw new RichMenuProvisioningError(
            "verify",
            getProviderErrorSummary(response.status, responseBody, [
                channelAccessToken,
            ]),
            { statusCode: response.status },
        );
    }

    const body = await readResponseJson(response);
    if (!isRecord(body) || typeof body.richMenuId !== "string") {
        throw new RichMenuProvisioningError(
            "verify",
            "LINE returned an invalid default Rich Menu response",
        );
    }

    return body.richMenuId;
}

export async function provisionRoutineRichMenu(
    options: {
        apply: boolean;
        imagePath?: string;
        fetchImpl?: FetchImplementation;
    },
): Promise<RoutineRichMenuProvisionResult> {
    const result = await provisionNhfRichMenu(options);
    return {
        mode: result.mode,
        liffUrl: result.liffUrls.routine,
        definition: result.definition,
        imagePath: result.imagePath,
        image: result.image,
        routineFeatureEnabled: result.modules.routine.enabled,
        richMenuId: result.richMenuId,
        verifiedDefaultRichMenuId: result.verifiedDefaultRichMenuId,
    };
}

function hasValue(value: string | undefined): boolean {
    return Boolean(value?.trim());
}

export async function getRoutineRichMenuStatus(
    fetchImpl: FetchImplementation = fetch,
): Promise<RoutineRichMenuStatus> {
    const lineConfiguration = getLineConfigurationStatus();
    const { liffIdConfigured, channelAccessTokenConfigured } = lineConfiguration;
    const liffUrl = liffIdConfigured ? buildRoutineLiffUrl() : null;
    const sessionSecretConfigured = hasValue(process.env.LINE_LIFF_SESSION_SECRET);
    const sessionTtlConfigured = hasValue(process.env.LINE_LIFF_SESSION_TTL_SECONDS);
    let sessionConfigValid = false;
    try {
        getLineLiffSessionConfig();
        sessionConfigValid = true;
    } catch {
        sessionConfigValid = false;
    }

    const status: RoutineRichMenuStatus = {
        liffIdConfigured,
        loginChannelConfigured: lineConfiguration.loginChannelConfigured,
        channelAccessTokenConfigured,
        channelSecretConfigured: lineConfiguration.channelSecretConfigured,
        sessionSecretConfigured,
        sessionTtlConfigured,
        sessionConfigValid,
        routineFeatureEnabled: isFeatureEnabled(FEATURE_KEYS.routine),
        liffUrl,
        defaultRichMenuId: null,
        defaultRichMenuStatus: "not-checked",
        defaultRichMenuError: null,
    };

    if (!channelAccessTokenConfigured) {
        status.defaultRichMenuStatus = "unavailable";
        status.defaultRichMenuError = "NHFapp LINE channel access token is missing";
        return status;
    }

    try {
        status.defaultRichMenuId = await getRoutineRichMenuDefaultId(fetchImpl);
        status.defaultRichMenuStatus = status.defaultRichMenuId
            ? "configured"
            : "not-set";
    } catch (error) {
        status.defaultRichMenuStatus =
            error instanceof RichMenuProvisioningError && error.statusCode === 403
                ? "managed-elsewhere"
                : "unavailable";
        status.defaultRichMenuError = error instanceof Error
            ? error.message
            : "Unable to check the default Rich Menu";
    }

    return status;
}

export async function prepareNhfRichMenu(
    imagePath = getNhfRichMenuImagePath(),
): Promise<NhfRichMenuPreparation & { imageBytes: Buffer }> {
    let channelAccessToken: string;
    try {
        ({ channelAccessToken } = getLineMessagingConfig());
    } catch {
        throw new RichMenuProvisioningError(
            "configuration",
            "NHFapp LINE channel access token is not configured",
        );
    }

    const liffUrls = {
        stock: buildLiffUrl(APP_ROUTES.line.stock),
        leave: buildLiffUrl(APP_ROUTES.line.leave),
        routine: buildLiffUrl(APP_ROUTES.line.routine),
    };
    const definition = buildNhfRichMenuDefinition(liffUrls);
    validateNhfRichMenuDefinition(definition);
    const image = await validateNhfRichMenuImage(imagePath);

    return {
        liffUrls,
        definition,
        imagePath,
        image,
        imageBytes: await readFile(imagePath),
        modules: getLiffHomeModules(),
        channelAccessToken,
    };
}

function toNhfProvisionResult(
    prepared: NhfRichMenuPreparation,
    mode: "dry-run" | "applied",
    result: {
        richMenuId?: string;
        verifiedDefaultRichMenuId?: string;
    } = {},
): NhfRichMenuProvisionResult {
    return {
        mode,
        liffUrls: prepared.liffUrls,
        definition: prepared.definition,
        imagePath: prepared.imagePath,
        image: prepared.image,
        modules: prepared.modules,
        ...result,
    };
}

export async function getNhfRichMenuDefaultId(
    fetchImpl: FetchImplementation = fetch,
): Promise<string | null> {
    return getRoutineRichMenuDefaultId(fetchImpl);
}

export function validateNhfRichMenuId(richMenuId: string): string {
    const normalizedRichMenuId = richMenuId.trim();
    if (!RICH_MENU_ID_PATTERN.test(normalizedRichMenuId)) {
        throw new RichMenuProvisioningError(
            "configuration",
            "Rich Menu ID is invalid",
        );
    }

    return normalizedRichMenuId;
}

export async function setNhfRichMenuDefault(
    options: {
        richMenuId: string;
        apply: boolean;
        fetchImpl?: FetchImplementation;
    },
): Promise<NhfRichMenuDefaultResult> {
    const richMenuId = validateNhfRichMenuId(options.richMenuId);
    if (!options.apply) {
        return { mode: "dry-run", richMenuId };
    }

    let channelAccessToken: string;
    try {
        ({ channelAccessToken } = getLineMessagingConfig());
    } catch {
        throw new RichMenuProvisioningError(
            "configuration",
            "NHFapp LINE channel access token is not configured",
        );
    }

    const fetchImpl = options.fetchImpl ?? fetch;
    await requestLineApi({
        phase: "set-default",
        endpoint: `${LINE_MESSAGING_API_URL}/v2/bot/user/all/richmenu/${encodeURIComponent(richMenuId)}`,
        channelAccessToken,
        method: "POST",
        fetchImpl,
        richMenuId,
    });

    const verifiedDefaultRichMenuId = await getNhfRichMenuDefaultId(fetchImpl);
    if (verifiedDefaultRichMenuId !== richMenuId) {
        throw new RichMenuProvisioningError(
            "verify",
            "LINE default Rich Menu does not match the requested menu",
            { richMenuId },
        );
    }

    return {
        mode: "applied",
        richMenuId,
        verifiedDefaultRichMenuId,
    };
}

export async function provisionNhfRichMenu(
    options: {
        apply: boolean;
        imagePath?: string;
        fetchImpl?: FetchImplementation;
    },
): Promise<NhfRichMenuProvisionResult> {
    const prepared = await prepareNhfRichMenu(options.imagePath);
    if (!options.apply) {
        return toNhfProvisionResult(prepared, "dry-run");
    }

    const fetchImpl = options.fetchImpl ?? fetch;
    await requestLineApi({
        phase: "validate",
        endpoint: `${LINE_MESSAGING_API_URL}/v2/bot/richmenu/validate`,
        channelAccessToken: prepared.channelAccessToken,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify(prepared.definition),
        fetchImpl,
    });

    const createResponse = await requestLineApi({
        phase: "create",
        endpoint: `${LINE_MESSAGING_API_URL}/v2/bot/richmenu`,
        channelAccessToken: prepared.channelAccessToken,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify(prepared.definition),
        fetchImpl,
    });
    if (!isRecord(createResponse) || typeof createResponse.richMenuId !== "string") {
        throw new RichMenuProvisioningError(
            "create",
            "LINE returned an invalid Rich Menu ID",
        );
    }
    const richMenuId = createResponse.richMenuId;

    await requestLineApi({
        phase: "upload",
        endpoint: `${LINE_MESSAGING_DATA_API_URL}/v2/bot/richmenu/${encodeURIComponent(richMenuId)}/content`,
        channelAccessToken: prepared.channelAccessToken,
        method: "POST",
        contentType: prepared.image.contentType,
        body: new Uint8Array(prepared.imageBytes),
        richMenuId,
        fetchImpl,
    });

    await requestLineApi({
        phase: "set-default",
        endpoint: `${LINE_MESSAGING_API_URL}/v2/bot/user/all/richmenu/${encodeURIComponent(richMenuId)}`,
        channelAccessToken: prepared.channelAccessToken,
        method: "POST",
        fetchImpl,
        richMenuId,
    });

    const verifiedDefaultRichMenuId = await getNhfRichMenuDefaultId(fetchImpl);
    if (verifiedDefaultRichMenuId !== richMenuId) {
        throw new RichMenuProvisioningError(
            "verify",
            "LINE default Rich Menu does not match the newly provisioned menu",
            { richMenuId },
        );
    }

    return toNhfProvisionResult(prepared, "applied", {
        richMenuId,
        verifiedDefaultRichMenuId,
    });
}

export async function getNhfRichMenuStatus(
    fetchImpl: FetchImplementation = fetch,
): Promise<NhfRichMenuStatus> {
    const legacyStatus = await getRoutineRichMenuStatus(fetchImpl);
    const liffUrls = legacyStatus.liffIdConfigured
        ? {
              stock: buildLiffUrl(APP_ROUTES.line.stock),
              leave: buildLiffUrl(APP_ROUTES.line.leave),
              routine: buildLiffUrl(APP_ROUTES.line.routine),
          }
        : null;

    return {
        liffIdConfigured: legacyStatus.liffIdConfigured,
        loginChannelConfigured: legacyStatus.loginChannelConfigured,
        channelAccessTokenConfigured: legacyStatus.channelAccessTokenConfigured,
        channelSecretConfigured: legacyStatus.channelSecretConfigured,
        sessionSecretConfigured: legacyStatus.sessionSecretConfigured,
        sessionTtlConfigured: legacyStatus.sessionTtlConfigured,
        sessionConfigValid: legacyStatus.sessionConfigValid,
        modules: getLiffHomeModules(),
        liffUrls,
        defaultRichMenuId: legacyStatus.defaultRichMenuId,
        defaultRichMenuStatus: legacyStatus.defaultRichMenuStatus,
        defaultRichMenuError: legacyStatus.defaultRichMenuError,
    };
}
