import { NextRequest, NextResponse } from "next/server";
import deployment from "../../../../../../deployments/genlayer/studionet.json";
import { genLayerResolverConfig, readResolutionById, readResolutionHistory } from "@/lib/genlayer-resolver";

export const dynamic = "force-dynamic";

type DeploymentResolution = { transaction?: string };

export async function GET(request: NextRequest) {
  try {
    const isLegacyDeployment = genLayerResolverConfig.contractAddress.toLowerCase() === deployment.contract_address.toLowerCase();
    const transactionById = (isLegacyDeployment
      ? deployment.resolutions
      : deployment.submission_deployment.resolutions) as Record<string, DeploymentResolution>;
    const legacyIds = isLegacyDeployment
      ? Object.keys(transactionById)
      : [];
    const requestedId = request.nextUrl.searchParams.get("id")?.trim();
    const requestedRecord = requestedId ? await readResolutionById(requestedId) : null;
    const records = requestedId
      ? (requestedRecord ? [requestedRecord] : [])
      : await readResolutionHistory(legacyIds);
    return NextResponse.json({
      contract_address: genLayerResolverConfig.contractAddress,
      network: genLayerResolverConfig.network,
      records: records.map((record) => ({
        ...record,
        transaction_hash: transactionById[record.resolution_id]?.transaction ?? null,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "GenLayer state is temporarily unavailable.",
        technical_error: error instanceof Error ? error.message : "Unknown read failure",
      },
      { status: 502 },
    );
  }
}
