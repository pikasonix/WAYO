import React from "react";
import { Button } from "@/components/ui/button";
import TiptapEditor from "@/components/common/TiptapEditor";

interface AboutSectionProps {
  projectDescription: string;
  onEditAbout: () => void;
}

const AboutSection: React.FC<AboutSectionProps> = ({
  projectDescription,
  onEditAbout,
}) => {
  return (
    <section aria-labelledby="project-about-heading">
      <div className="flex items-start gap-4">
        <div className="flex-grow text-sm text-gray-700">
          {projectDescription ? (
            <TiptapEditor value={projectDescription} editable={false} />
          ) : (
            <p className="italic text-gray-500">No description provided.</p>
          )}
        </div>
        <Button
          variant="outline"
          onClick={onEditAbout}
          className="flex-shrink-0"
        >
          Chỉnh sửa
        </Button>
      </div>
    </section>
  );
};

export default AboutSection;
