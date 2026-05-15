'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { Save } from 'lucide-react';

interface Settings {
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  shippingDays: number;
  exchangeDays: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    bankName: '',
    bankAccount: '',
    bankHolder: '',
    shippingDays: 3,
    exchangeDays: 7,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch<Settings | null>('/settings').then((s) => {
      if (s) setSettings(s);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch('/settings', { method: 'PUT', body: JSON.stringify(settings) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">전역 설정</h1>
        <p className="text-muted-foreground">모든 공구 프로젝트에 공통 적용되는 설정입니다. 상품관리·FAQ는 각 프로젝트 설정에서 관리하세요.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">입금 계좌 정보</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>은행명</Label>
              <Input value={settings.bankName} onChange={(e) => setSettings({ ...settings, bankName: e.target.value })} placeholder="국민은행" />
            </div>
            <div className="space-y-2">
              <Label>계좌번호</Label>
              <Input value={settings.bankAccount} onChange={(e) => setSettings({ ...settings, bankAccount: e.target.value })} placeholder="123-456-789012" />
            </div>
            <div className="space-y-2">
              <Label>예금주</Label>
              <Input value={settings.bankHolder} onChange={(e) => setSettings({ ...settings, bankHolder: e.target.value })} placeholder="홍길동" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">배송 정책</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>배송 예정일 (영업일 기준)</Label>
              <Input type="number" value={settings.shippingDays} onChange={(e) => setSettings({ ...settings, shippingDays: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>교환 가능일</Label>
              <Input type="number" value={settings.exchangeDays} onChange={(e) => setSettings({ ...settings, exchangeDays: Number(e.target.value) })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        <Save className="w-4 h-4 mr-2" />
        {saving ? '저장 중...' : saved ? '저장됨 ✓' : '저장'}
      </Button>
    </div>
  );
}
