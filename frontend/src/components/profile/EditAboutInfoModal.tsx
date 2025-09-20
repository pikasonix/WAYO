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

interface EditAboutInfoModal {
  isOpen: boolean;
  onClose: () => void;
  initialData: ProjectInfo;
  onSave: (updatedData: ProjectInfo) => void;
}

const MAX_DESCRIPTION_LENGTH = 5000;

/**
 * Modal for editing project information (description), using shadcn/ui.
 *
 * @param {EditAboutInfoModal} props Component props.
 * @returns {JSX.Element} The edit project info modal.
 */
const EditAboutInfoModal: React.FC<EditAboutInfoModal> = ({
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
      title="Mô tả Dự án"
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
        </form>
      </Form>
    </ScrollableModal>
  );
};

export default EditAboutInfoModal;
