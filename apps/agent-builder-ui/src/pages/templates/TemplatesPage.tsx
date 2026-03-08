export default function TemplatesPage() {
    return (
        <div className="flex h-full flex-col gap-6 p-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Message Templates</h1>
                <p className="text-sm text-muted-foreground">Reusable prompt templates with variable interpolation</p>
            </div>
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border">
                <p className="text-sm text-muted-foreground">Template management coming in a future phase</p>
            </div>
        </div>
    )
}
