import React, { useEffect } from "react";
import { useForm, ControllerRenderProps } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VIETNAM_LOCATIONS } from "@/lib/constants/options";

export interface ContactInfo {
  location: string | null;
  website: string | null;
  portfolio: string | null;
  email: string | null;
}

interface EditContactInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: ContactInfo;
  onSave: (updatedData: ContactInfo) => void; // Callback to save changes
}

interface SelectOption {
  value: string;
  label: string;
}

/**
 * Modal for editing user contact information, using shadcn/ui components.
 *
 * @param {EditContactInfoModalProps} props Component props.
 * @returns {JSX.Element} The edit contact info modal.
 */
const EditContactInfoModal: React.FC<EditContactInfoModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSave,
}) => {
  const form = useForm<ContactInfo>({
    mode: "onChange", // Update validation on change
    defaultValues: initialData,
  });

  useEffect(() => {
    if (isOpen) {
      form.reset(initialData);
    }
  }, [isOpen, initialData, form]);

  const onSubmit = (data: ContactInfo) => {
    // Ensure empty strings are saved as null if desired by backend
    const processedData: ContactInfo = {
      location: data.location || null,
      website: data.website || null,
      portfolio: data.portfolio || null,
      email: data.email || null,
    };
    onSave(processedData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Thông tin liên hệ</DialogTitle>
          {/* <DialogDescription> Make changes to your contact info here. Click save when you're done. </DialogDescription> */}
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 py-4"
          >
            <FormField
              control={form.control}
              name="location"
              rules={{ required: "Địa điểm là bắt buộc." }}
              render={({ field }) => {
                const currentLocation = field.value;
                const selectOptions: SelectOption[] = [];

                // 1. "None" option
                selectOptions.push({
                  value: "--NONE--",
                  label: "Không chọn / Để trống",
                });

                // 2. Current custom value, if it exists and is not a predefined one
                if (
                  currentLocation &&
                  currentLocation !== "--NONE--" &&
                  !VIETNAM_LOCATIONS.includes(currentLocation)
                ) {
                  // Ensure it's not already added (e.g. if logic changes)
                  if (
                    !selectOptions.find((opt) => opt.value === currentLocation)
                  ) {
                    selectOptions.push({
                      value: currentLocation,
                      label: currentLocation,
                    });
                  }
                }

                // 3. Predefined Vietnamese locations
                VIETNAM_LOCATIONS.forEach((loc) => {
                  // Only add if not already present (covers the custom value case too)
                  if (!selectOptions.find((opt) => opt.value === loc)) {
                    selectOptions.push({ value: loc, label: loc });
                  }
                });

                return (
                  <FormItem className="grid grid-cols-4 items-center gap-4">
                    <FormLabel className="text-right">Địa điểm *</FormLabel>
                    <div className="col-span-3">
                      <FormControl>
                        <Select
                          onValueChange={(value) =>
                            field.onChange(value === "--NONE--" ? null : value)
                          }
                          value={currentLocation ?? "--NONE--"}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn địa điểm của bạn" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.value === "--NONE--" ? (
                                  <em>{opt.label}</em>
                                ) : (
                                  opt.label
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </div>
                    <div className="col-start-2 col-span-3">
                      <FormMessage />
                    </div>
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="website"
              rules={{ required: "Website là bắt buộc." }}
              render={({
                field,
              }: {
                field: ControllerRenderProps<ContactInfo, "website">;
              }) => (
                <FormItem className="grid grid-cols-4 items-center gap-4">
                  <FormLabel className="text-right">Website *</FormLabel>
                  <FormControl className="col-span-3">
                    <Input
                      placeholder="https://websitecuaban.com"
                      {...field}
                      value={field.value ?? ""}
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
              name="portfolio" // Not required
              render={({
                field,
              }: {
                field: ControllerRenderProps<ContactInfo, "portfolio">;
              }) => (
                <FormItem className="grid grid-cols-4 items-center gap-4">
                  <FormLabel className="text-right">Hồ sơ năng lực</FormLabel>
                  <FormControl className="col-span-3">
                    <Input
                      placeholder="https://hosonangluccuaban.com"
                      {...field}
                      value={field.value ?? ""}
                      className="w-full m-0 h-12 px-3 py-2.5 border border-gray-200 rounded-md focus-visible:ring-2 focus-visible:ring-sky-300"
                    />
                  </FormControl>
                  {/* No FormMessage needed if not required, unless other validation added */}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email" // Not required
              render={({
                field,
              }: {
                field: ControllerRenderProps<ContactInfo, "email">;
              }) => (
                <FormItem className="grid grid-cols-4 items-center gap-4">
                  <FormLabel className="text-right">Email</FormLabel>
                  <FormControl className="col-span-3">
                    <Input
                      type="email"
                      placeholder="email.cua.ban@example.com"
                      {...field}
                      value={field.value ?? ""}
                      className="w-full m-0 h-12 px-3 py-2.5 border border-gray-200 rounded-md focus-visible:ring-2 focus-visible:ring-sky-300"
                    />
                  </FormControl>
                  {/* No FormMessage needed if not required */}
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button variant="outline" type="button" onClick={onClose}>
                Hủy
              </Button>
              <Button type="submit" disabled={!form.formState.isValid}>
                Xong
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditContactInfoModal;
