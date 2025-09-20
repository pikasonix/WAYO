import React from "react";
import { Button } from "@/components/ui/button";

interface ContactSectionProps {
  contactInfo: {
    location: string | null;
    website: string | null;
    portfolio: string | null;
    email: string | null;
  };
  onEditContact: () => void;
}

const renderDetail = (
  label: string,
  value: string | null | undefined,
  isLink: boolean = false,
  linkPrefix: string = "http://"
) => {
  const displayValue = value || <span className="text-gray-400">Chưa có</span>;
  const formatUrl = (url: string): string => {
    if (/^(https?:|mailto:)/i.test(url)) {
      return url;
    }
    return `${linkPrefix}${url}`;
  };

  return (
    <div>
      <span className="font-medium text-gray-500 text-sm">{label}:</span>{" "}
      {isLink && typeof value === "string" && value ? (
        <a
          href={formatUrl(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline break-all"
        >
          {value}
        </a>
      ) : (
        <span className="text-sm text-gray-700 break-words">
          {displayValue}
        </span>
      )}
    </div>
  );
};

const ContactSection: React.FC<ContactSectionProps> = ({
  contactInfo,
  onEditContact,
}) => {
  return (
    <section aria-labelledby="project-contact-heading">
      <div className="flex items-start gap-4">
        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
          {renderDetail("Địa chỉ", contactInfo.location)}
          {renderDetail("Website", contactInfo.website, true)}
          {renderDetail("Email", contactInfo.email, true, "mailto:")}
          {renderDetail("Hồ sơ năng lực", contactInfo.portfolio, true)}
        </div>
        <Button
          variant="outline"
          onClick={onEditContact}
          className="flex-shrink-0"
        >
          Chỉnh sửa
        </Button>
      </div>
    </section>
  );
};

export default ContactSection;
