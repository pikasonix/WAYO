import React, { useEffect, useState } from "react";
import { useForm, ControllerRenderProps } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import {
  COFOUNDER_TYPE_OPTIONS,
  PARTNER_TYPE_OPTIONS,
} from "@/lib/constants/options";

export interface FundingInfo {
  investment: string | null;
  currency: string | null;
  cofounders: string[];
  partners: string[];
}

interface EditFundingInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: FundingInfo;
  onSave: (updatedData: FundingInfo) => void;
}

/**
 * Modal for editing project funding information, using shadcn/ui components.
 *
 * @param {EditFundingInfoModalProps} props Component props.
 * @returns {JSX.Element} The edit funding info modal.
 */
const EditFundingInfoModal: React.FC<EditFundingInfoModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSave,
}) => {
  const form = useForm<FundingInfo>({
    mode: "onChange",
    defaultValues: initialData,
  });

  const watchedCurrency = form.watch("currency");

  // Local state for the formatted investment value displayed in the input
  const [formattedInvestment, setFormattedInvestment] = useState<string>("");

  const formatInputValue = (
    value: string | null | undefined,
    currency: string | null
  ): string => {
    if (!value) return "";
    const cleanedValue = value.toString().replace(/[^\d]/g, ""); // Remove non-digits
    if (cleanedValue === "") return "";
    const numberValue = parseInt(cleanedValue, 10);
    if (isNaN(numberValue)) return "";
    if (currency === "VND") {
      return numberValue.toLocaleString("vi-VN");
    }
    return numberValue.toLocaleString("en-US");
  };

  // Effect to handle form reset and initial formatting
  useEffect(() => {
    if (isOpen) {
      form.reset(initialData);
      setFormattedInvestment(
        formatInputValue(initialData.investment, initialData.currency)
      );
    }
  }, [isOpen, initialData, form]);

  useEffect(() => {
    const currentInvestment = form.getValues("investment");
    setFormattedInvestment(formatInputValue(currentInvestment, watchedCurrency));
  }, [watchedCurrency, form]);

  const onSubmit = (data: FundingInfo) => {
    // Ensure empty strings are saved as null if desired
    const processedData: FundingInfo = {
      investment: data.investment || null,
      currency: data.currency || "USD",
      cofounders: data.cofounders ?? [],
      partners: data.partners ?? [],
    };
    onSave(processedData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Thông tin Gọi Vốn Dự Án</DialogTitle>
        </DialogHeader>
        {/* Wrap content in Shadcn Form */}
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 py-4"
          >
            <FormField
              control={form.control}
              name="investment"
              // rules={{
              //   required: "Số tiền đầu tư là bắt buộc.",
              // }}
              render={({
                field,
              }: {
                field: ControllerRenderProps<FundingInfo, "investment">;
              }) => {
                // Custom onChange handler for formatting
                const handleInputChange = (
                  e: React.ChangeEvent<HTMLInputElement>
                ) => {
                  const rawValue = e.target.value;
                  const cleanedValue = rawValue.replace(/[^\d]/g, ""); // Remove non-digits
                  field.onChange(cleanedValue); // Update RHF with raw value
                  setFormattedInvestment(formatInputValue(cleanedValue, watchedCurrency)); // Update display state
                };

                return (
                  <FormItem className="grid grid-cols-4 items-center gap-4">
                    <FormLabel className="text-right">Vốn huy động</FormLabel>
                    <FormControl className="col-span-3">
                      <div className="flex items-center rounded-md bg-white border border-gray-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200 transition-all duration-200">
                        <Input
                          placeholder="Nhập số tiền cần gọi vốn"
                          {...field}
                          value={formattedInvestment}
                          onChange={handleInputChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          className="block min-w-0 min-h-12 grow py-3 px-3 text-base text-gray-900 placeholder:text-gray-400 bg-transparent rounded-l-md border-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9,.]*"
                        />
                        <div className="border-l border-gray-300">
                          <FormField
                            control={form.control}
                            name="currency"
                            render={({ field }) => (
                              <Select
                                value={field.value || "USD"}
                                onValueChange={(value) => {
                                  field.onChange(value);
                                }}
                              >
                                <SelectTrigger className="w-[90px] h-full px-4 border-0 rounded-l-none rounded-r-md bg-transparent hover:bg-transparent shadow-none font-semibold text-gray-600 focus-visible:outline-none focus-visible:ring-0 text-sm">
                                  <SelectValue placeholder="Tiền tệ" />
                                </SelectTrigger>
                                <SelectContent className="w-[90px] min-w-[90px] mt-1">
                                  <SelectItem
                                    value="USD"
                                    className="py-2 text-sm cursor-pointer rounded-md data-[state=checked]:bg-gray-100 justify-center"
                                  >
                                    <span className="font-semibold">USD</span>
                                  </SelectItem>
                                  <SelectItem
                                    value="VND"
                                    className="py-2 text-sm cursor-pointer rounded-md data-[state=checked]:bg-gray-100 justify-center"
                                  >
                                    <span className="font-semibold">VND</span>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>

                      </div>
                    </FormControl>
                    <div className="col-start-2 col-span-3">
                      <FormMessage /> {/* Shows validation errors */}
                    </div>
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="cofounders"
              rules={{
                validate: (value) =>
                  value.length <= 2 ||
                  "Bạn chỉ có thể chọn tối đa 2 vai trò đồng sáng lập.",
              }}
              render={({
                field,
              }: {
                field: ControllerRenderProps<FundingInfo, "cofounders">;
              }) => (
                <FormItem className="grid grid-cols-4 items-start gap-4">
                  <FormLabel className="text-right">Đồng sáng lập</FormLabel>

                  <div className="col-span-3">
                    <FormControl>
                      <MultiSelectDropdown
                        options={COFOUNDER_TYPE_OPTIONS}
                        value={field.value ?? []}
                        onChange={(newVal) =>
                          form.setValue("cofounders", newVal, {
                            shouldDirty: true,
                          })
                        }
                        placeholder="Chọn vai trò đồng sáng lập..."
                        label="Đồng sáng lập"
                      />
                    </FormControl>
                    <div className="text-xs text-muted-foreground mt-1">
                      {`Đồng sáng lập đã chọn ${((field.value as string[]) ?? []).length}/2`}
                    </div>
                  </div>
                  <div className="col-start-2 col-span-3">
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="partners"
              rules={{
                validate: (value) =>
                  value.length <= 2 || "Bạn chỉ có thể chọn tối đa 2 đối tác.",
              }}
              render={({
                field,
              }: {
                field: ControllerRenderProps<FundingInfo, "partners">;
              }) => (
                <FormItem className="grid grid-cols-4 items-start gap-4">
                  <FormLabel className="text-right">Đối tác</FormLabel>
                  <div className="col-span-3">
                    <FormControl>
                      <MultiSelectDropdown
                        options={PARTNER_TYPE_OPTIONS}
                        value={field.value ?? []}
                        onChange={(newVal) =>
                          form.setValue("partners", newVal, {
                            shouldDirty: true,
                          })
                        }
                        placeholder="Chọn loại đối tác..."
                        label="Đối tác"
                      />
                    </FormControl>
                    <div className="text-xs text-muted-foreground mt-1">
                      {`Đối tác đã chọn ${((field.value as string[]) ?? []).length}/2`}
                    </div>
                  </div>
                  <div className="col-start-2 col-span-3">
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Huỷ
              </Button>
              <Button type="submit">Lưu thay đổi</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditFundingInfoModal;
