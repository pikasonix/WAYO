/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useGetSessionQuery } from "@/lib/redux/services/auth";
import {
  useGetProfileQuery,
  useGetProjectQuery,
  useUpdateProfileMutation,
  useUploadAvatarMutation,
  useUpdateProjectContactMutation,
  useUpdateProjectFundingMutation,
  useUpdateProjectDetailsMutation,
  useUpdateProjectAboutMutation,
  type DbProfile,
  type DbProject,
} from "@/lib/redux/services/profileApi";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileTabs from "@/components/profile/ProfileTabs";
import EditContactInfoModal from "@/components/profile/EditContactInfoModal";
import EditFundingInfoModal from "@/components/profile/EditFundingInfoModal";
import EditProjectInfoModal from "@/components/profile/EditProjectInfoModal";
import EditAboutInfoModal from "@/components/profile/EditAboutInfoModal";
import CompleteProfileModal from "@/components/profile/CompleteProfileModal";
import type { ContactInfo } from "@/components/profile/EditContactInfoModal";
import type { FundingInfo } from "@/components/profile/EditFundingInfoModal";
import type { ProjectInfo } from "@/components/profile/EditProjectInfoModal";
import type { ProfileData } from "@/components/profile/CompleteProfileModal";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { useOptionLabels } from "@/lib/hooks/useOptionLabels";
// import { PROFILE_TYPE_OPTIONS, PROFILE_ROLE_OPTIONS } from "@/lib/constants/options"; // Removed

const LoadingSpinner: React.FC = () => (
  <div className="flex justify-center items-center h-64">
    <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

const ErrorDisplay: React.FC<{ message: string }> = ({ message }) => (
  <div className="text-center text-red-600 py-10">
    <p>Error loading data: {message}</p>
    <p>Please try refreshing the page.</p>
  </div>
);

// Helper type for RTK Query errors (more specific than any)
type RtkQueryError = FetchBaseQueryError & {
  data?: string | { message?: string }; // Adjust based on actual error data structure
};

/**
 * User profile page showing auth state and account information
 */
const ProfilePage: React.FC = () => {
  const { data: sessionData, isLoading: isLoadingSession } =
    useGetSessionQuery();
  const router = useRouter();
  const userId = sessionData?.session?.user?.id;

  const { getLabels, getLabel } = useOptionLabels();

  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isEditContactModalOpen, setIsEditContactModalOpen] = useState(false);
  const [isEditFundingModalOpen, setIsEditFundingModalOpen] = useState(false);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [isEditAboutModalOpen, setIsEditAboutModalOpen] = useState(false);

  const {
    data: profileData,
    error: profileError,
    isLoading: isLoadingProfile,
    isFetching: isFetchingProfile,
  } = useGetProfileQuery(userId!, {
    skip: !userId,
  });

  const {
    data: projectData,
    error: projectError,
    isLoading: isLoadingProject,
    isFetching: isFetchingProject,
  } = useGetProjectQuery(userId!, {
    skip: !userId,
  });

  const [updateProfile] = useUpdateProfileMutation();
  const [uploadAvatar] = useUploadAvatarMutation();
  const [updateProjectContact] = useUpdateProjectContactMutation();
  const [updateProjectFunding] = useUpdateProjectFundingMutation();
  const [updateProjectDetails] = useUpdateProjectDetailsMutation();
  const [updateProjectAbout] = useUpdateProjectAboutMutation();

  useEffect(() => {
    if (!isLoadingSession && !userId) {
      router.push("/login");
    }
  }, [isLoadingSession, userId, router]);

  // --- Mutation Error Handling Helper ---
  const handleMutationError = useCallback((err: unknown, context: string) => {
    console.error(`Failed to ${context}:`, err);
    let message = `Could not ${context}.`;
    // Type guard to check if it's an RTK Query error structure
    if (
      typeof err === "object" &&
      err !== null &&
      ("status" in err || "error" in err) // Check for common RTK error fields
    ) {
      const rtkError = err as RtkQueryError;
      // Extract message from data field (could be string or object)
      if (typeof rtkError.data === "string") {
        message = rtkError.data;
      } else if (typeof rtkError.data === "object" && rtkError.data?.message) {
        message = rtkError.data.message;
      } else if ("error" in rtkError && typeof rtkError.error === "string") {
        // Fallback for CUSTOM_ERROR structure
        message = rtkError.error;
      }
    }
    toast.error(`Error: ${message}`);
  }, []);

  const isLoading =
    isLoadingSession ||
    isLoadingProfile ||
    isLoadingProject ||
    isFetchingProfile ||
    isFetchingProject;

  const queryError = profileError || projectError;

  const isProfileComplete = React.useMemo(() => {
    if (!profileData) return false;
    const name = (profileData.name || "").trim();
    const type = Array.isArray(profileData.type)
      ? profileData.type[0]
      : profileData.type;
    const phoneDigits = (profileData.phone || "").replace(/\D/g, "");
    const validPhone = phoneDigits.length >= 9;
    return Boolean(name && type && validPhone);
  }, [profileData]);

  useEffect(() => {
    if (!isLoading && userId) {
      const nameMissing = !(profileData?.name && String(profileData.name).trim());
      const typeMissing = !(
        (Array.isArray(profileData?.type) && profileData!.type!.length > 0) ||
        (typeof profileData?.type === "string" && String(profileData?.type).trim() !== "")
      );
      const phoneMissing = !(profileData?.phone && String(profileData?.phone).trim());
      if (nameMissing || typeMissing || phoneMissing) {
        setIsEditProfileModalOpen(true);
      }
    }
  }, [isLoading, userId, profileData]);

  if (isLoading) {
    return (
      <div className="pt-16 sm:pt-20 md:pt-24 max-w-4xl mx-auto px-4">
        <LoadingSpinner />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="pt-16 sm:pt-20 md:pt-24 max-w-4xl mx-auto px-4 text-center">
        Authenticating... If this persists, please{" "}
        <a href="/login" className="underline">
          log in
        </a>
        .
      </div>
    );
  }

  if (queryError) {
    const errorMessage =
      typeof queryError === "object" && queryError && "data" in queryError
        ? String(queryError.data)
        : "An unknown error occurred";
    return (
      <div className="pt-16 sm:pt-20 md:pt-24 max-w-4xl mx-auto px-4">
        <ErrorDisplay message={errorMessage} />
      </div>
    );
  }

  const handleEditProfile = () => setIsEditProfileModalOpen(true);
  // const handleEditProject = () => setIsEditProjectModalOpen(true);
  // const handleEditContact = () => setIsEditContactModalOpen(true);
  // const handleEditAbout = () => setIsEditAboutModalOpen(true);
  // const handleEditFunding = () => setIsEditFundingModalOpen(true);

  const handleEditProject = () => {
    if (!isProfileComplete) {
      toast("Vui lòng hoàn thành hồ sơ trước khi chỉnh sửa các thông tin khác.");
      setIsEditProfileModalOpen(true);
      return;
    }
    setIsEditProjectModalOpen(true);
  };

  const handleEditContact = () => {
    if (!isProfileComplete) {
      toast("Vui lòng hoàn thành hồ sơ trước khi chỉnh sửa các thông tin khác.");
      setIsEditProfileModalOpen(true);
      return;
    }
    setIsEditContactModalOpen(true);
  };

  const handleEditAbout = () => {
    if (!isProfileComplete) {
      toast("Vui lòng hoàn thành hồ sơ trước khi chỉnh sửa các thông tin khác.");
      setIsEditProfileModalOpen(true);
      return;
    }
    setIsEditAboutModalOpen(true);
  };

  const handleEditFunding = () => {
    if (!isProfileComplete) {
      toast("Vui lòng hoàn thành hồ sơ trước khi chỉnh sửa các thông tin khác.");
      setIsEditProfileModalOpen(true);
      return;
    }
    setIsEditFundingModalOpen(true);
  };

  const handleSaveContactInfo = async (updatedData: ContactInfo) => {
    if (!userId) return;
    try {
      await updateProjectContact({ userId, contactInfo: updatedData }).unwrap();
      toast.success("Contact info updated!");
      setIsEditContactModalOpen(false);
    } catch (err) {
      handleMutationError(err, "save contact info");
    }
  };
  const handleSaveFundingInfo = async (updatedData: FundingInfo) => {
    if (!userId) return;

    // Create a payload with the correct types for the backend
    // endDate and startDate have been removed from FundingInfo
    const backendPayload = {
      ...updatedData,
    };

    try {
      await updateProjectFunding({
        userId,
        fundingInfo: backendPayload as any,
      }).unwrap();
      toast.success("Funding info updated!");
      setIsEditFundingModalOpen(false);
    } catch (err) {
      handleMutationError(err, "save funding info");
    }
  };
  const handleSaveProjectInfo = async (updatedData: ProjectInfo) => {
    if (!userId) return;
    try {
      await updateProjectDetails({ userId, details: updatedData }).unwrap();
      toast.success("Project details updated!");
      setIsEditProjectModalOpen(false);
    } catch (err) {
      handleMutationError(err, "save project details");
    }
  };
  const handleSaveAboutInfo = async (description: string) => {
    if (!userId) return;
    try {
      await updateProjectAbout({ userId, about: description }).unwrap();
      toast.success("Project description updated!");
      setIsEditAboutModalOpen(false);
    } catch (err) {
      handleMutationError(err, "save project description");
    }
  };
  const handleSaveProfileInfo = async (updatedData: ProfileData) => {
    if (!userId) return;
    const { avatarFile, ...profileDetails } = updatedData;
    let newAvatarUrl = profileData?.avatar_url;

    if (avatarFile) {
      try {
        const uploadResult = await uploadAvatar({
          userId,
          file: avatarFile,
        }).unwrap();
        newAvatarUrl = uploadResult.publicUrl;
        toast.success("Avatar uploaded!");
      } catch (err) {
        handleMutationError(err, "upload avatar");
      }
    }

    // 2. Update profile details (including potentially new avatar URL)
    console.log("Attempting to update profile with payload:", {
      id: userId,
      name: profileDetails.name,
      type: profileDetails.type,
      role: profileDetails.role,
      phone: profileDetails.phone,
      avatar_url: newAvatarUrl,
    });
    try {
      const profileUpdatePayload = {
        id: userId,
        name: profileDetails.name,
        type: [profileDetails.type],
        phone: profileDetails.phone,
        role: profileDetails.role,
        avatar_url: newAvatarUrl,
      };
      await updateProfile(profileUpdatePayload).unwrap();
      toast.success("Profile updated!");
      console.log("Profile update successful, closing modal.");
      setIsEditProfileModalOpen(false); // Close modal on successful profile update
    } catch (err) {
      console.error(
        "Profile update failed after potential avatar upload:",
        err
      );
      handleMutationError(err, "update profile");
    }
  };

  const currentProfile: Partial<DbProfile> = profileData ?? {};
  const currentProject: Partial<DbProject> = projectData ?? {};

  // Shape data specifically for modals, ensuring defaults for required fields
  const contactInfoForModal: ContactInfo = {
    location: currentProject.location ?? null, // Ensure null if undefined
    website: currentProject.website ?? null,
    portfolio: currentProject.portfolio ?? null,
    email: currentProject.email ?? null,
  };

  // This object has endDate as Date | null - Correct for the modal
  const fundingInfoForModal: FundingInfo = {
    investment: currentProject.investment ?? null,
    currency: currentProject.currency ?? "USD",
    cofounders: currentProject.cofounders ?? [],
    partners: currentProject.partners ?? [],
  };

  const projectInfoForModal: ProjectInfo = {
    title: currentProject.title ?? "",
    tags: currentProject.tags ?? [], // Keep raw values for the modal's MultiSelectDropdown
    description: currentProject.description ?? "",
  };

  const profileInfoForModal: ProfileData = {
    name: currentProfile.name ?? "",
    avatarUrl: currentProfile.avatar_url, // Can be null
    type:
      Array.isArray(currentProfile.type) && currentProfile.type.length > 0
        ? currentProfile.type[0]
        : typeof currentProfile.type === "string"
          ? currentProfile.type
          : "",
    role: currentProfile.role ?? [],
    phone: currentProfile.phone ?? "",
    avatarFile: undefined, // Not part of fetched data
  };

  const roleLabels = getLabels("profileRole", currentProfile.role, "");
  const currentProfileType =
    Array.isArray(currentProfile.type) && currentProfile.type.length > 0
      ? currentProfile.type[0]
      : typeof currentProfile.type === "string"
        ? currentProfile.type
        : undefined;
  const typeLabel = currentProfileType
    ? getLabel("profileType", currentProfileType, "")
    : "";

  const projectCategoryLabels = getLabels(
    "projectCategory",
    currentProject.tags,
    ""
  ); // Added

  const userTypeBadges = typeLabel ? [typeLabel] : [];

  // Pass processed labels for display to ProfileTabs, but raw tags to EditProjectInfoModal
  const projectTagsForDisplay = projectCategoryLabels
    ? projectCategoryLabels.split(", ")
    : [];

  return (
    <div className="flex flex-col min-h-screen pt-16">
      <Toaster />
      {(isFetchingProfile || isFetchingProject) && (
        <div className="fixed top-4 right-4 z-50 bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm">
          Updating...
        </div>
      )}
      <main className="flex-grow container max-w-6xl mx-auto px-4 py-12 md:px-8">
        <ProfileHeader
          user={{
            name: currentProfile.name ?? "Unnamed User",
            avatarUrl: currentProfile.avatar_url || "",
            isVerified: false,
            typeBadges: userTypeBadges, // Use the processed type labels for badges
            roleDisplayText: roleLabels, // Use the processed role labels for display text
          }}
          onEdit={handleEditProfile}
        />

        <ProfileTabs
          project={{
            title: currentProject.title ?? "Untitled Project",
            tags: projectTagsForDisplay, // Changed to use labels for display
            description:
              currentProject.description ?? "No description available.",
            contactInfo: contactInfoForModal,
            fundingInfo: fundingInfoForModal,
          }}
          onEditProject={handleEditProject}
          onEditContact={handleEditContact}
          onEditAbout={handleEditAbout}
          onEditFunding={handleEditFunding}
        />
      </main>
      <EditContactInfoModal
        isOpen={isEditContactModalOpen}
        onClose={() => setIsEditContactModalOpen(false)}
        initialData={contactInfoForModal}
        onSave={handleSaveContactInfo}
      />
      <EditFundingInfoModal
        isOpen={isEditFundingModalOpen}
        onClose={() => setIsEditFundingModalOpen(false)}
        initialData={fundingInfoForModal}
        onSave={handleSaveFundingInfo}
      />
      <EditProjectInfoModal
        isOpen={isEditProjectModalOpen}
        onClose={() => setIsEditProjectModalOpen(false)}
        initialData={projectInfoForModal}
        onSave={handleSaveProjectInfo}
      />
      <EditAboutInfoModal
        isOpen={isEditAboutModalOpen}
        onClose={() => setIsEditAboutModalOpen(false)}
        initialData={projectInfoForModal}
        onSave={handleSaveProjectInfo}
      />
      <CompleteProfileModal
        isOpen={isEditProfileModalOpen}
        onClose={() => setIsEditProfileModalOpen(false)}
        initialData={profileInfoForModal}
        onSave={handleSaveProfileInfo}
      />
    </div>
  );
};

export default ProfilePage;
