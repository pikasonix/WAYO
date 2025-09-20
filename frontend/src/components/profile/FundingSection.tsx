import React from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useOptionLabels } from "@/lib/hooks/useOptionLabels";

interface FundingInfo {
  investment: string | null;
  currency: string | null;
  cofounders: string[];
  partners: string[];
}

interface FundingSectionProps {
  fundingInfo: FundingInfo;
  onEditFunding: () => void;
}

const FundingInfoCard: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <div className="flex-1">
    <h4 className="text-sm font-medium text-[#0D92F4]">{title}</h4>
    <div className="mt-1 text-xl font-semibold text-[#0049AC]">{children}</div>
  </div>
);

const FundingSection: React.FC<FundingSectionProps> = ({
  fundingInfo,
  onEditFunding,
}) => {
  const { getLabels, getLabel } = useOptionLabels();
  const cofounderValues = fundingInfo.cofounders || [];
  const cofounderLabels: string | string[] =
    cofounderValues.length > 1
      ? cofounderValues.map((v) => getLabel("cofounder", v))
      : getLabels("cofounder", cofounderValues);

  const partnerValues = fundingInfo.partners || [];
  const partnerLabels: string | string[] =
    partnerValues.length > 1
      ? partnerValues.map((v) => getLabel("partner", v))
      : getLabels("partner", partnerValues);
  const placeholder = <span className="text-gray-400">Chưa có</span>;

  return (
    <section aria-labelledby="project-funding-heading">
      <div className="flex items-start gap-4">
        <div className="flex-grow flex flex-col md:flex-row gap-8 text-left">
          <FundingInfoCard title="Vốn huy động">
            {fundingInfo.investment
              ? formatCurrency(fundingInfo.investment, fundingInfo.currency)
              : placeholder}
          </FundingInfoCard>

          <FundingInfoCard title="Đồng sáng lập">
            {Array.isArray(cofounderLabels) ? (
              <div className="flex flex-col items-start gap-1">
                {cofounderLabels.map((label, idx) => (
                  <span key={idx}>{label}</span>
                ))}
              </div>
            ) : (
              cofounderLabels || placeholder
            )}
          </FundingInfoCard>

          <FundingInfoCard title="Đối tác">
            {Array.isArray(partnerLabels) ? (
              <div className="flex flex-col items-start gap-1">
                {partnerLabels.map((label, idx) => (
                  <span key={idx}>{label}</span>
                ))}
              </div>
            ) : (
              partnerLabels || placeholder
            )}
          </FundingInfoCard>
        </div>
        <Button
          variant="outline"
          onClick={onEditFunding}
          className="flex-shrink-0"
        >
          Chỉnh sửa
        </Button>
      </div>
    </section>
  );
};

export default FundingSection;
