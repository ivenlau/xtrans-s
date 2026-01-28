import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, ScanLine, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { HybridConnectionManager } from "../lib/hybrid-connection-manager";
import { sdpCompressor } from "../lib/sdp-compressor";

interface ManualConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionManager: HybridConnectionManager | null;
}

export function ManualConnectionDialog({
  open,
  onOpenChange,
  connectionManager,
}: ManualConnectionDialogProps) {
  const [activeTab, setActiveTab] = useState<"sender" | "receiver">("sender");
  const [step, setStep] = useState<number>(1);
  const [offerCode, setOfferCode] = useState<string>("");
  const [answerCode, setAnswerCode] = useState<string>("");
  const [inputCode, setInputCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // 重置状态
  useEffect(() => {
    if (open) {
      setStep(1);
      setOfferCode("");
      setAnswerCode("");
      setInputCode("");
      setIsLoading(false);
    }
  }, [open]);

  // 监听连接成功事件
  useEffect(() => {
    if (!open || !connectionManager) return;

    const handleConnectionEvent = (event: any) => {
      // 监听握手成功事件
      if (event.type === 'handshakeReceived') {
        toast.success("连接建立成功！");
        onOpenChange(false);
      }
      // 也可以监听连接状态变化作为备选
      if (event.type === 'connectionStateChanged' && event.state?.status === 'connected') {
        console.log("连接状态变为已连接");
        toast.success("连接建立成功！");
        onOpenChange(false);
      }
    };

    connectionManager.addEventListener(handleConnectionEvent);

    return () => {
      connectionManager.removeEventListener(handleConnectionEvent);
    };
  }, [open, connectionManager, onOpenChange]);

  // 复制到剪贴板
  const handleCopy = async (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("已复制到剪贴板");
      } else {
        // 回退方案：使用 textarea 和 execCommand
        const textArea = document.createElement("textarea");
        textArea.value = text;

        // 确保 textarea 不可见但可选中
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);

        textArea.focus();
        textArea.select();

        try {
          const successful = document.execCommand('copy');
          if (successful) {
            setCopied(true);
            toast.success("已复制到剪贴板");
          } else {
            throw new Error("复制失败");
          }
        } finally {
          document.body.removeChild(textArea);
        }
      }

      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
      toast.error("复制失败，请手动复制");
    }
  };

  // 发起方：生成连接码 (Offer) - 已简化，使用压缩版本
  const handleGenerateOffer = async () => {
    if (!connectionManager) return;
    setIsLoading(true);
    try {
      // 创建一个临时的目标ID，实际连接建立后会更新
      const tempTargetId = "manual-target-" + Date.now();
      // createManualConnection 现在直接返回压缩后的连接码
      const offerCode = await connectionManager.createManualConnection(tempTargetId);
      setOfferCode(offerCode);
      setStep(2);
    } catch (error) {
      console.error(error);
      toast.error(`生成连接码失败: ${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 发起方：完成连接 (处理 Answer) - 已简化，直接传递连接码
  const handleFinalizeConnection = async () => {
    if (!connectionManager || !inputCode) return;
    setIsLoading(true);
    try {
      const cleanCode = inputCode.trim();

      // 验证连接码格式
      if (!cleanCode) {
        throw new Error("连接码不能为空");
      }

      // 直接传递连接码，connectionManager 会自动解压
      await connectionManager.finalizeManualConnection(tempConnectionId, cleanCode);
      toast.success("连接成功！");
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(`连接失败: ${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setIsLoading(false);
    }
  };


  // 接收方：处理 Offer 并生成 Answer - 已简化，直接传递连接码
  const handleProcessOffer = async () => {
    if (!connectionManager || !inputCode) return;
    setIsLoading(true);
    try {
      const cleanCode = inputCode.trim();

      // 验证连接码格式
      if (!cleanCode) {
        throw new Error("连接码不能为空");
      }

      // 接收方生成一个临时 ID 给发起方
      const tempInitiatorId = "manual-initiator-" + Date.now();
      // acceptManualConnection 会自动解压 offer 并返回压缩的 answer
      const answerCode = await connectionManager.acceptManualConnection(tempInitiatorId, cleanCode);
      setAnswerCode(answerCode);
      setStep(2);
    } catch (error) {
      console.error("处理连接码错误:", error);
      toast.error(`处理连接码失败: ${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 状态保存临时 ID
  const [tempConnectionId, setTempConnectionId] = useState<string>("");

  // 发起方生成 Offer（使用压缩版本）
  const generateOffer = async () => {
    if (!connectionManager) return;
    setIsLoading(true);
    try {
      const id = "manual-peer-" + Math.random().toString(36).substring(2, 9);
      setTempConnectionId(id);
      // createManualConnection 现在直接返回压缩后的连接码
      const offerCode = await connectionManager.createManualConnection(id);
      setOfferCode(offerCode);
      setStep(2);

      // 可选：显示压缩效果
      const isCompressed = sdpCompressor.isCompressed(offerCode);
      if (isCompressed) {
        console.log('✨ 使用了压缩连接码');
      }
    } catch (error) {
      console.error(error);
      toast.error(`生成连接码失败: ${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 发起方完成连接（使用压缩版本）
  const finalizeConnection = async () => {
    if (!connectionManager || !inputCode || !tempConnectionId) return;
    setIsLoading(true);
    try {
      const cleanCode = inputCode.trim();

      // 验证连接码格式
      if (!cleanCode) {
        throw new Error("连接码不能为空");
      }

      // 直接传递连接码，connectionManager 会自动解压
      await connectionManager.finalizeManualConnection(tempConnectionId, cleanCode);
      toast.success("连接成功！");
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(`连接失败: ${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>手动连接设备</DialogTitle>
          <DialogDescription>
            通过扫描二维码或复制连接码来连接设备（无需服务器）
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => {
          setActiveTab(v as "sender" | "receiver");
          setStep(1);
          setOfferCode("");
          setAnswerCode("");
          setInputCode("");
        }} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sender">我是发起方</TabsTrigger>
            <TabsTrigger value="receiver">我是接收方</TabsTrigger>
          </TabsList>

          {/* 发起方界面 */}
          <TabsContent value="sender" className="space-y-4 py-4">
            {step === 1 && (
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="text-center space-y-2">
                  <p className="text-sm text-gray-500">第一步：生成连接码并发送给对方</p>
                </div>
                <Button onClick={generateOffer} disabled={isLoading} className="w-full">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
                  生成我的连接码
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="space-y-2 text-center">
                  <p className="text-sm font-medium">1. 让对方扫描或复制此代码</p>
                  <div className="flex justify-center p-4 bg-white rounded-lg border">
                    <QRCodeSVG value={offerCode} size={160} />
                  </div>
                  <div className="flex gap-2">
                    <Input value={offerCode} readOnly className="font-mono text-xs" />
                    <Button size="icon" variant="outline" onClick={() => handleCopy(offerCode)}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-center">2. 输入对方的响应码</p>
                  <Input 
                    placeholder="粘贴对方的响应码" 
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                  />
                  <Button onClick={finalizeConnection} disabled={!inputCode || isLoading} className="w-full">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "完成连接"}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* 接收方界面 */}
          <TabsContent value="receiver" className="space-y-4 py-4">
            {step === 1 && (
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <p className="text-sm text-gray-500">第一步：输入发起方的连接码</p>
                </div>
                <Input 
                  placeholder="粘贴发起方的连接码" 
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                />
                <Button onClick={handleProcessOffer} disabled={!inputCode || isLoading} className="w-full">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                  下一步
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="space-y-2 text-center">
                  <p className="text-sm font-medium">第二步：将此响应码发回给发起方</p>
                  <div className="flex justify-center p-4 bg-white rounded-lg border">
                    <QRCodeSVG value={answerCode} size={160} />
                  </div>
                  <div className="flex gap-2">
                    <Input value={answerCode} readOnly className="font-mono text-xs" />
                    <Button size="icon" variant="outline" onClick={() => handleCopy(answerCode)}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-4">
                    等待发起方确认连接...
                  </p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
