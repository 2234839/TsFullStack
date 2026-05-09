import { TokenGrantService, type GrantTxClient } from '../TokenGrantService';
import { MS_PER_DAY, DAYS_PER_MONTH_APPROX, DAYS_PER_YEAR } from '../../util/constants';

/** 套餐信息（发放代币所需的字段子集） */
interface PackageForGrant {
  id: number;
  type: string;
  amount: number;
  name: string;
  durationMonths: number;
  restrictedType: unknown;
}

/** 将 restrictedType 归一化为 string | undefined（数据库字段可能是 JSON 对象） */
function normalizeRestrictedType(raw: unknown): string | undefined {
  return typeof raw === 'string' ? raw : undefined;
}

/**
 * 根据套餐类型发放代币（支付成功后的通用逻辑）
 *
 * 三处调用方共用：
 * - PaymentService.handleWebhook（Webhook 回调）
 * - OrderReconciliationService.reconcile（对账补偿）
 * - paymentApi.confirmOrderPayment（微信人工确认）
 */
export async function grantTokensForPackage(
  tx: GrantTxClient,
  userId: string,
  pkg: PackageForGrant,
  sourceId: number,
  description: string,
): Promise<void> {
  const normalizedRestrictedType = normalizeRestrictedType(pkg.restrictedType);

  if (pkg.durationMonths > 0) {
    const now = new Date();
    const endDate = new Date(now.getTime() + pkg.durationMonths * DAYS_PER_MONTH_APPROX * MS_PER_DAY);

    const subscription = await tx.userTokenSubscription.create({
      data: {
        userId,
        packageId: pkg.id,
        startDate: now,
        endDate,
        nextGrantDate: now,
        active: true,
        grantsCount: 0,
      },
    });

    await TokenGrantService.grantFirstTime(tx, {
      id: subscription.id,
      userId,
      package: {
        type: pkg.type,
        amount: pkg.amount,
        name: pkg.name,
        restrictedType: normalizedRestrictedType,
      },
    });
  } else {
    const expiresAt = new Date(Date.now() + DAYS_PER_YEAR * MS_PER_DAY);
    await tx.token.create({
      data: {
        userId,
        type: pkg.type,
        amount: pkg.amount,
        used: 0,
        expiresAt,
        source: 'payment',
        sourceId: String(sourceId),
        description,
        restrictedType: normalizedRestrictedType ?? '[]',
        active: true,
      },
    });
  }
}
