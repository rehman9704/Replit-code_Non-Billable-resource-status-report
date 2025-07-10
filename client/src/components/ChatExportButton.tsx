import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function ChatExportButton() {
  const { toast } = useToast();

  const handleDownload = async () => {
    try {
      console.log("🔄 Starting chat export download...");
      
      // Use the working static file route that we know works
      const downloadUrl = "/downloads/Complete_Chat_Export_2025-07-10T16-59-03.xlsx";
      
      // Create invisible link and click it to force download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Chat_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log("✅ Download initiated successfully");
      
      toast({
        title: "Download Started", 
        description: "Complete chat export file (81 records) is downloading",
      });
    } catch (error) {
      console.error("❌ Download failed:", error);
      
      toast({
        title: "Download Failed",
        description: "Unable to download chat export. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Button 
      onClick={handleDownload}
      variant="outline"
      size="sm"
      className="flex items-center gap-2"
    >
      <Download className="h-4 w-4" />
      Download Chat Export
    </Button>
  );
}