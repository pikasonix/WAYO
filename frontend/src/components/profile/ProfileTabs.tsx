import React, { useState } from "react";
import ProjectHeaderSection from "./ProjectHeaderSection";
import AboutSection from "./AboutSection";
import ContactSection from "./ContactSection";
import FundingSection from "./FundingSection";
import NotificationPanel from "./NotificationPanel";

// Define specific types for props
interface ContactInfo {
  location: string | null;
  website: string | null;
  portfolio: string | null;
  email: string | null;
}

interface FundingInfo {
  investment: string | null;
  currency: string | null;
  cofounders: string[];
  partners: string[];
}

interface ProfileTabsProps {
  project: {
    title: string;
    tags: string[];
    description: string;
    contactInfo: ContactInfo;
    fundingInfo: FundingInfo;
  };
  onEditProject: () => void;
  onEditContact: () => void;
  onEditAbout: () => void;
  onEditFunding: () => void;
}

/**
 * Manages the vertical tabs and displays the corresponding content section.
 *
 * @param {ProfileTabsProps} props Component props.
 * @returns {JSX.Element} The profile tabs component.
 */
const ProfileTabs: React.FC<ProfileTabsProps> = ({
  project,
  onEditProject,
  onEditContact,
  onEditAbout,
  onEditFunding,
}) => {
  const [activeTabId, setActiveTabId] = useState<string>("info");

  const tabs = [
    { id: "info", name: "Thông tin dự án" },
    { id: "notifications", name: "Thông báo", disabled: false },
  ];

  const ActiveComponent = () => {
    if (activeTabId === "info") {
      return (
        <div className="bg-white p-6 sm:p-8 rounded-lg border border-gray-200 space-y-8">
          <ProjectHeaderSection
            projectTitle={project.title}
            projectTags={project.tags}
            onEditProject={onEditProject}
          />
          <hr className="border-gray-200" />
          <ContactSection
            contactInfo={project.contactInfo}
            onEditContact={onEditContact}
          />
          <hr className="border-gray-200" />
          <AboutSection
            projectDescription={project.description}
            onEditAbout={onEditAbout}
          />
          <hr className="border-gray-200" />
          <FundingSection
            fundingInfo={project.fundingInfo}
            onEditFunding={onEditFunding}
          />
        </div>
      );
    }
    if (activeTabId === "notifications") {
      return <NotificationPanel />;
    }
    return <div>Select a tab</div>;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 mt-8">
      {/* Vertical Tabs Navigation */}
      <div className="w-full lg:w-1/5 flex-shrink-0">
        <nav className="flex lg:flex-col gap-2 lg:gap-1 lg:mb-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTabId(tab.id)}
              className={`flex-1 text-center group flex items-center justify-center lg:justify-start px-3 py-2 text-sm font-medium rounded-md ${activeTabId === tab.id
                ? "bg-gray-100 text-gray-900"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                } ${tab.disabled ? "cursor-not-allowed opacity-50" : ""}`}
              aria-current={activeTabId === tab.id ? "page" : undefined}
              disabled={tab.disabled}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content Area */}
      <div className="w-full lg:w-4/5">
        <ActiveComponent />
      </div>
    </div>
  );
};

export default ProfileTabs;
