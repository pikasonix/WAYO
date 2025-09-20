import React, { useEffect, useState } from "react";
import { useForm, ControllerRenderProps } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TiptapEditor from "@/components/common/TiptapEditor";
import ScrollableModal from "@/components/common/ScrollableModal";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import { PROJECT_CATEGORY_OPTIONS } from "@/lib/constants/options";

export interface ProjectInfo {
  title: string;
  tags: string[];
  description: string;
}

interface EditProjectInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: ProjectInfo;
  onSave: (updatedData: ProjectInfo) => void;
}

const MAX_DESCRIPTION_LENGTH = 5000;

/**
 * Modal for editing project information (title, tags, description), using shadcn/ui.
 *
 * @param {EditProjectInfoModalProps} props Component props.
 * @returns {JSX.Element} The edit project info modal.
 */
const EditProjectInfoModal: React.FC<EditProjectInfoModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSave,
}) => {
  const form = useForm<ProjectInfo>({
    mode: "onChange",
    defaultValues: initialData,
  });

  const [descriptionLength, setDescriptionLength] = useState(0);
  const formId = "edit-project-info-form";

  useEffect(() => {
    if (isOpen) {
      form.reset(initialData);
      setDescriptionLength(initialData.description?.length || 0);
    }
  }, [isOpen, initialData, form]);

  const onSubmit = (data: ProjectInfo) => {
    onSave(data);
    onClose();
  };

  const footerContent = (
    <>
      <Button variant="outline" type="button" onClick={onClose}>
        Hủy
      </Button>
      <Button type="submit" form={formId} disabled={!form.formState.isValid}>
        Xong
      </Button>
    </>
  );

  return (
    <ScrollableModal
      open={isOpen}
      onOpenChange={onClose}
      title="Thông tin Dự án"
      footer={footerContent}
    >
      <Form {...form}>
        <form
          id={formId}
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="title"
            rules={{ required: "Tên dự án là bắt buộc." }}
            render={({
              field,
            }: {
              field: ControllerRenderProps<ProjectInfo, "title">;
            }) => (
              <FormItem className="grid grid-cols-4 items-center gap-4">
                <FormLabel className="text-right">Tên dự án *</FormLabel>
                <FormControl className="col-span-3">
                  <Input
                    placeholder="Nhập tên dự án"
                    {...field}
                    className="w-full m-0 h-12 px-3 py-2.5 border border-gray-200 rounded-md focus-visible:ring-2 focus-visible:ring-sky-300"
                  />
                </FormControl>
                <div className="col-start-2 col-span-3">
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tags"
            rules={{
              validate: (value) =>
                value.length <= 3 || "Bạn chỉ có thể chọn tối đa 3 loại dự án.",
            }}
            render={({
              field,
            }: {
              field: ControllerRenderProps<ProjectInfo, "tags">;
            }) => (
              <FormItem className="grid grid-cols-4 items-start gap-4">
                <FormLabel className="text-right pt-2">Phân Loại Dự Án</FormLabel>
                <div className="col-span-3">
                  <FormControl>
                    <MultiSelectDropdown
                      options={PROJECT_CATEGORY_OPTIONS}
                      value={field.value ?? []}
                      onChange={(newValues) => field.onChange(newValues)}
                      placeholder="Chọn phân loại dự án..."
                      label="Phân Loại Dự Án"
                    />
                  </FormControl>
                  <div className="text-xs text-muted-foreground mt-1">
                    {`Loại dự án đã chọn ${((field.value as string[]) ?? []).length}/3`}
                  </div>
                </div>
                <div className="col-start-2 col-span-3">
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          {/*  # remove description in EditProjectInfoModal */}
          {/*
          <FormField
            control={form.control}
            name="description"
            rules={{ required: "Mô tả là bắt buộc." }}
            render={({
              field,
            }: {
              field: ControllerRenderProps<ProjectInfo, "description">;
            }) => (
              <FormItem className="grid grid-cols-4 items-start gap-4">
                <FormLabel className="text-right pt-2">Giới thiệu *</FormLabel>
                <div className="col-span-3 space-y-1">
                  <FormControl>
                    <TiptapEditor
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Viết giới thiệu ngắn gọn..."
                      maxLength={MAX_DESCRIPTION_LENGTH}
                      onCharacterCountChange={setDescriptionLength}
                    />
                  </FormControl>
                  <FormDescription
                    className={`text-xs ${descriptionLength > MAX_DESCRIPTION_LENGTH
                      ? "text-red-600"
                      : "text-gray-500"
                      }`}
                  >
                    {descriptionLength} / {MAX_DESCRIPTION_LENGTH} ký tự
                  </FormDescription>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
          */}
        </form>
      </Form>
    </ScrollableModal>
  );
};

export default EditProjectInfoModal;
