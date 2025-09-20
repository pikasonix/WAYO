import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { PostgrestError } from "@supabase/supabase-js";
import type { StorageError } from "@supabase/storage-js";
import { supabase } from "../../../../supabase/client"; // Corrected path
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query"; // Import FetchBaseQueryError
import { ContactInfo } from "@/components/profile/EditContactInfoModal";
// import { FundingInfo } from "@/components/profile/EditFundingInfoModal"; // Removed unused import
import { ProjectInfo } from "@/components/profile/EditProjectInfoModal";

// Define Profile type based on DB schema (adjust nullability as needed)
export interface DbProfile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  intro: string | null;
  type: string[] | null;
  role: string[] | null;
  phone?: string | null;
  updated_at?: string;
}

// Define Project type based on DB schema (adjust nullability)
export interface DbProject {
  id: string;
  user_id: string;
  title: string | null;
  tags: string[] | null;
  description: string | null;
  location: string | null;
  website: string | null;
  portfolio: string | null;
  email: string | null;
  investment: string | null;
  currency: string | null;
  cofounders: string[] | null;
  partners: string[] | null;
  start_date: string | null; // Date as string for simplicity
  end_date: string | null; // Date as string
  created_at?: string;
  updated_at?: string;
}

// Define a type for the funding info payload expected by the backend
interface FundingInfoPayload {
  investment: string | null;
  currency: string | null;
  cofounders: string[];
  partners: string[];
  startDate: string | null;
  endDate: string | null; // Expect string for backend
}

// Define a new type for the combined Project and Profile data
export interface ProjectWithFounder extends DbProject {
  profiles: {
    name: string | null;
    role: string[] | null;
    avatar_url: string | null;
    type: string[] | null;
  } | null; // Profile might not exist, handle null
}

// --- Helper function to format Supabase errors for RTK Query ---
/**
 * Formats a Supabase PostgrestError or StorageError into an RTK Query FetchBaseQueryError shape.
 * @param error - The Supabase error object.
 * @returns An object conforming to FetchBaseQueryError.
 */
function formatSupabaseError(
  error: PostgrestError | StorageError
): FetchBaseQueryError {
  let status: number | "CUSTOM_ERROR" = "CUSTOM_ERROR"; // Default status for RTK Query errors
  const message = error.message || "An unknown Supabase error occurred";

  // Try to map PostgrestError codes (often strings like 'PGRSTXXX') to numeric or custom statuses
  if ("code" in error && error.code) {
    // Simple mapping: Use 500 for server errors, 400 for potential client errors, else CUSTOM_ERROR
    // This is a basic heuristic and might need refinement based on specific PGRST codes
    if (error.code.startsWith("PGRST")) {
      status = 500; // Assume server-side issue with PostgREST
    } else {
      // Attempt to parse other codes as numbers if possible
      const parsedCode = parseInt(error.code, 10);
      status = !isNaN(parsedCode) ? parsedCode : "CUSTOM_ERROR";
    }
  } else if (error instanceof Error && !(error instanceof PostgrestError)) {
    // Handle StorageError or other generic errors - use a generic server error status
    status = 500;
  }

  // Conditionally return the object shape based on whether status is 'CUSTOM_ERROR' or a number
  if (status === "CUSTOM_ERROR") {
    return {
      status: "CUSTOM_ERROR",
      error: message, // Include the error message string when status is CUSTOM_ERROR
      data: undefined, // data is optional here
    };
  } else {
    // status is a number here
    return {
      status: status,
      data: message, // Put the original error message in the data field when status is a number
    };
  }
}

// --- RTK Query API Slice Definition ---
export const profileApi = createApi({
  reducerPath: "profileApi",
  // baseQuery: supabaseBaseQuery, // Using direct Supabase calls in endpoints is easier here
  baseQuery: fetchBaseQuery({ baseUrl: "/" }), // Dummy baseQuery, endpoints handle Supabase calls
  tagTypes: ["Profile", "Project"], // Define tags for caching

  endpoints: (builder) => ({
    // --- Profile Endpoints ---
    getProfile: builder.query<DbProfile | null, string>({
      // Arg: userId
      queryFn: async (userId) => {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle(); // Returns single object or null
        if (error) return { error: formatSupabaseError(error) };
        return { data };
      },
      providesTags: (result) =>
        result ? [{ type: "Profile", id: result.id }] : [],
    }),

    updateProfile: builder.mutation<
      DbProfile,
      Partial<DbProfile> & { id: string }
    >({
      queryFn: async (profileUpdate) => {
        const { id, ...updateData } = profileUpdate;
        // Ensure updated_at is set for both insert and update
        const payload = {
          ...updateData,
          id: id, // Include id for upsert
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from("profiles")
          // Use upsert instead of update
          .upsert(payload)
          // Still select the result (either inserted or updated row)
          .select()
          .single(); // Expecting one row after upsert

        if (error) return { error: formatSupabaseError(error) };
        return { data };
      },
      invalidatesTags: (result, error, profileUpdate) =>
        profileUpdate ? [{ type: "Profile", id: profileUpdate.id }] : [],
    }),

    uploadAvatar: builder.mutation<
      { path: string; publicUrl: string },
      { file: File; userId: string }
    >({
      queryFn: async ({ file, userId }) => {
        const fileExt = file.name.split(".").pop();
        const filePath = `/${userId}/avatar-${Date.now()}.${fileExt}`; // Unique path per user

        const { error: uploadError } = await (supabase.storage as any)
          .from("avatars") // Your bucket name
          .upload(filePath, file, { upsert: true }); // Use upsert to overwrite

        if (uploadError) return { error: formatSupabaseError(uploadError) };

        // Get public URL
        const { data: urlData } = (supabase.storage as any)
          .from("avatars")
          .getPublicUrl(filePath);

        return { data: { path: filePath, publicUrl: urlData.publicUrl } };
      },
      // Doesn't directly invalidate profile cache,
      // updateProfile should be called after with the new URL
    }),

    // --- Project Endpoints ---
    getAllProjects: builder.query<ProjectWithFounder[], void>({
      queryFn: async () => {
        // Modify select to fetch related profile data
        const { data, error } = await supabase.from("projects").select(`
            *,
            profiles (
              name,
              role,
              avatar_url,
              type
            )
          `);

        if (error) return { error: formatSupabaseError(error) };
        // Ensure data is not null, return empty array if it is
        // Also assert the type to match the new interface
        return { data: (data as ProjectWithFounder[]) ?? [] };
      },
      // Provide a general tag for the list of projects
      providesTags: (result) =>
        result
          ? [
            // Provide a specific tag for each project
            ...result.map(({ id }) => ({ type: "Project" as const, id })),
            { type: "Project", id: "LIST" },
          ]
          : [{ type: "Project", id: "LIST" }],
    }),

    getProject: builder.query<DbProject | null, string>({
      // Arg: userId
      queryFn: async (userId) => {
        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(); // Assume one project per user for now

        if (error) return { error: formatSupabaseError(error) };
        return { data };
      },
      providesTags: (result, error, userId) =>
        userId ? [{ type: "Project", id: userId }] : [],
    }),

    getProjectById: builder.query<ProjectWithFounder | null, string>({
      // Arg: projectId
      queryFn: async (projectId) => {
        const { data, error } = await supabase
          .from("projects")
          .select(
            `
            *,
            profiles (
              name,
              role,
              avatar_url,
              type,
              intro
            )
          `
          )
          .eq("id", projectId)
          .maybeSingle(); // Returns single object or null
        if (error) return { error: formatSupabaseError(error) };
        return { data: data as ProjectWithFounder | null };
      },
      providesTags: (result, error, projectId) =>
        result ? [{ type: "Project", id: projectId }] : [],
    }),

    // Mutation to update different parts of the project
    // Using partial updates based on what the modal provides
    updateProjectContact: builder.mutation<
      DbProject,
      { userId: string; contactInfo: ContactInfo }
    >({
      queryFn: async ({ userId, contactInfo }) => {
        // Prepare payload for upsert
        const payload = {
          user_id: userId,
          ...contactInfo,
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from("projects")
          // Specify user_id as the conflict target for upsert
          .upsert(payload, { onConflict: "user_id" })
          .select()
          .single();
        if (error) return { error: formatSupabaseError(error) };
        return { data };
      },
      // Invalidate based on userId argument
      invalidatesTags: (result, error, { userId }) =>
        userId ? [{ type: "Project", id: userId }] : [],
    }),

    updateProjectFunding: builder.mutation<
      DbProject,
      { userId: string; fundingInfo: FundingInfoPayload }
    >({
      queryFn: async ({ userId, fundingInfo }) => {
        // fundingInfo now correctly expects endDate as string | null
        const {
          startDate,
          endDate, // Now correctly typed as string | null
          investment,
          currency,
          cofounders,
          partners,
        } = fundingInfo;

        // Construct the payload only with fields that exist in DbProject
        const payload: Partial<DbProject> & { user_id: string } = {
          user_id: userId,
          investment: investment,
          currency: currency,
          cofounders: cofounders,
          partners: partners,
          start_date: startDate,
          end_date: endDate, // Pass the string directly
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from("projects")
          .upsert(payload, { onConflict: "user_id" })
          .select()
          .single();
        if (error) return { error: formatSupabaseError(error) };
        return { data };
      },
      invalidatesTags: (result, error, { userId }) =>
        userId ? [{ type: "Project", id: userId }] : [],
    }),

    updateProjectDetails: builder.mutation<
      DbProject,
      { userId: string; details: ProjectInfo }
    >({
      queryFn: async ({ userId, details }) => {
        // Prepare payload for upsert
        const payload = {
          user_id: userId,
          ...details,
          updated_at: new Date().toISOString(),
        };
        const { data, error } = await supabase
          .from("projects")
          // Specify user_id as the conflict target for upsert
          .upsert(payload, { onConflict: "user_id" })
          .select()
          .single();
        if (error) return { error: formatSupabaseError(error) };
        return { data };
      },
      // Invalidate based on userId argument
      invalidatesTags: (result, error, { userId }) =>
        userId ? [{ type: "Project", id: userId }] : [],
    }),

    updateProjectAbout: builder.mutation<
      DbProject,
      { userId: string; about: string }
    >({
      queryFn: async ({ userId, about }) => {
        // Prepare payload for upsert
        const payload: Partial<DbProject> & { user_id: string } = {
          user_id: userId,
          description: about,
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from("projects")
          // Specify user_id as the conflict target for upsert
          .upsert(payload, { onConflict: "user_id" })
          .select()
          .single();

        if (error) return { error: formatSupabaseError(error) };
        return { data };
      },
      invalidatesTags: (result, error, { userId }) =>
        userId ? [{ type: "Project", id: userId }] : [],
    }),
  }),
});

// Export hooks for usage in functional components
export const {
  useGetProfileQuery,
  useUpdateProfileMutation,
  useUploadAvatarMutation,
  useGetAllProjectsQuery,
  useGetProjectQuery,
  useGetProjectByIdQuery,
  useUpdateProjectContactMutation,
  useUpdateProjectFundingMutation,
  useUpdateProjectDetailsMutation,
  useUpdateProjectAboutMutation,
} = profileApi;
