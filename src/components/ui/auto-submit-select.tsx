"use client";

interface AutoSubmitSelectProps {
  name: string;
  defaultValue: string;
  className?: string;
  children: React.ReactNode;
}

export function AutoSubmitSelect({
  name,
  defaultValue,
  className,
  children,
}: AutoSubmitSelectProps) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      onChange={(e) => {
        const form = e.currentTarget.closest("form");
        if (form) form.submit();
      }}
      className={className}
    >
      {children}
    </select>
  );
}
