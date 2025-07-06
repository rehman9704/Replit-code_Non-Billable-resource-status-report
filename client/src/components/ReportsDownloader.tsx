import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileSpreadsheet } from "lucide-react";

export function ReportsDownloader() {
  const downloadFile = async (filename: string, displayName: string) => {
    try {
      const response = await fetch(`/api/files/${filename}`);
      
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = displayName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert('Download failed. Please try again.');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Employee Chat Reports
          </CardTitle>
          <CardDescription>
            Download comprehensive analysis reports of restored chat messages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <h4 className="font-medium">Employee Chat Analysis Report</h4>
              <p className="text-sm text-muted-foreground">
                Complete analysis of all 122 chat messages with Zoho ID mapping
              </p>
            </div>
            <Button
              onClick={() => downloadFile(
                'Employee_Chat_Analysis_Report_2025-07-06.xlsx',
                'Employee_Chat_Analysis_Report_2025-07-06.xlsx'
              )}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
          
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <h4 className="font-medium">Zoho ID Chat Mapping Report</h4>
              <p className="text-sm text-muted-foreground">
                Detailed mapping of 58 unique Zoho IDs with employee attribution
              </p>
            </div>
            <Button
              onClick={() => downloadFile(
                'Zoho_ID_Chat_Mapping_Report_2025-07-06.xlsx',
                'Zoho_ID_Chat_Mapping_Report_2025-07-06.xlsx'
              )}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
          
          <div className="text-xs text-muted-foreground mt-3">
            Reports generated on July 6, 2025 - All 122 original comments successfully restored
          </div>
        </CardContent>
      </Card>
    </div>
  );
}