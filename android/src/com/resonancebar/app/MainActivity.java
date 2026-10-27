package com.resonancebar.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final String ORIGIN="https://appassets.androidplatform.net";
    private static final int PICK_FILE=100, SAVE_FILE=101;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingExport;
    private final Object dataLock=new Object();

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(11,21,29));
        getWindow().setNavigationBarColor(Color.rgb(11,21,29));
        web=new WebView(this);
        web.setBackgroundColor(Color.rgb(11,21,29));
        web.setOnApplyWindowInsetsListener((view,insets)->{view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets.consumeSystemWindowInsets();});
        setContentView(web);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(true);
        web.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new NativeBridge(),"ResonanceNative");
        web.setWebViewClient(new WebViewClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request) {
                Uri uri=request.getUrl();
                if(!"https".equals(uri.getScheme()) || !"appassets.androidplatform.net".equals(uri.getHost())) return response(403,"text/plain","Blocked".getBytes(StandardCharsets.UTF_8));
                String name=uri.getPath(); if("/".equals(name)) name="/index.html";
                if(!name.matches("/(index\\.html|app\\.js|core\\.js|platform\\.js|styles\\.css|favicon\\.svg)")) return response(404,"text/plain",new byte[0]);
                String mime=name.endsWith(".js")?"text/javascript":name.endsWith(".css")?"text/css":name.endsWith(".svg")?"image/svg+xml":"text/html";
                try(InputStream input=getAssets().open("public"+name)){return response(200,mime,readAll(input));}
                catch(Exception e){return response(404,"text/plain",new byte[0]);}
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request) {
                Uri uri=request.getUrl();
                if(ORIGIN.equals(uri.getScheme()+"://"+uri.getHost())) return false;
                if("https".equals(uri.getScheme()))try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception e){notice("无法打开外部链接");}
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params) {
                if(fileCallback!=null)fileCallback.onReceiveValue(null);
                fileCallback=callback;
                Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);
                String[] types=params.getAcceptTypes();
                boolean image=false;for(String type:types)if(type.startsWith("image/"))image=true;
                intent.setType(image?"image/*":"*/*");
                if(image)intent.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"image/png","image/jpeg","image/webp"});
                try{startActivityForResult(intent,PICK_FILE);}catch(Exception e){fileCallback.onReceiveValue(null);fileCallback=null;notice("无法打开系统文件选择器");}
                return true;
            }
        });
        web.loadUrl(ORIGIN+"/");
    }

    private WebResourceResponse response(int code,String mime,byte[] body) {
        Map<String,String> headers=new HashMap<>();headers.put("Cache-Control","no-store");headers.put("X-Content-Type-Options","nosniff");
        headers.put("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'");
        return new WebResourceResponse(mime,"utf-8",code,code==200?"OK":"Blocked",headers,new ByteArrayInputStream(body));
    }
    private static byte[] readAll(InputStream input)throws IOException {
        ByteArrayOutputStream output=new ByteArrayOutputStream();byte[] buffer=new byte[16384];int length;
        while((length=input.read(buffer))!=-1)output.write(buffer,0,length);return output.toByteArray();
    }
    private void notice(String message){runOnUiThread(()->Toast.makeText(this,message,Toast.LENGTH_LONG).show());}
    private String error(String message){try{return new JSONObject().put("error",message).toString();}catch(Exception e){return "{\"error\":\"数据操作失败\"}";}}
    private File dataFile(){return new File(getFilesDir(),"recipes.json");}
    private String current()throws Exception {
        File file=dataFile();
        if(!file.exists()) {
            try(InputStream seed=getAssets().open("seed.json")){Files.write(file.toPath(),readAll(seed));}
        }
        return new String(Files.readAllBytes(file.toPath()),StandardCharsets.UTF_8);
    }
    public class NativeBridge {
        @JavascriptInterface public String readState(){synchronized(dataLock){try{return new JSONObject(current()).toString();}catch(Exception e){return error("本地资料无法读取，请保留数据并从 JSON 备份恢复："+e.getMessage());}}}
        @JavascriptInterface public String writeState(String text){synchronized(dataLock){
            try {
                if(text.getBytes(StandardCharsets.UTF_8).length>25*1024*1024)throw new Exception("完整备份不能超过 25 MB");
                JSONObject old=new JSONObject(current()),next=new JSONObject(text);
                if(next.getInt("schemaVersion")!=1 || next.getJSONArray("recipes").length()>200)throw new Exception("备份格式无效");
                if(old.getInt("revision")!=next.getInt("revision"))throw new Exception("数据版本已更新，请重新打开应用后重试");
                next.put("revision",old.getInt("revision")+1);
                File backup=new File(getFilesDir(),"backups");backup.mkdirs();
                Files.copy(dataFile().toPath(),new File(backup,"recipes-r"+old.getInt("revision")+"-"+System.currentTimeMillis()+".json").toPath());
                File temp=new File(getFilesDir(),"recipes.tmp");Files.write(temp.toPath(),next.toString().getBytes(StandardCharsets.UTF_8));
                Files.move(temp.toPath(),dataFile().toPath(),StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE);
                return next.toString();
            } catch(Exception e){return error("保存失败："+e.getMessage());}
        }}
        @JavascriptInterface public String exportFile(String name,String text,String mime){
            synchronized(dataLock){
                if(pendingExport!=null)return "请先完成当前文件的保存";
                if(text.length()>25*1024*1024)return "导出文件太大";
                pendingExport=text;
            }
            runOnUiThread(()->{
                try {
                    Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("text/plain".equals(mime)?"text/plain":"application/json");
                    intent.putExtra(Intent.EXTRA_TITLE,name.replaceAll("[\\\\/]","_").substring(0,Math.min(name.length(),150)));
                    startActivityForResult(intent,SAVE_FILE);
                }catch(Exception e){synchronized(dataLock){pendingExport=null;}notice("无法打开保存文件界面");}
            });return "";
        }
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request==PICK_FILE && fileCallback!=null){fileCallback.onReceiveValue(result==RESULT_OK && data!=null && data.getData()!=null?new Uri[]{data.getData()}:null);fileCallback=null;}
        if(request==SAVE_FILE){
            String text; synchronized(dataLock){text=pendingExport;pendingExport=null;}
            if(result==RESULT_OK && data!=null && data.getData()!=null && text!=null){
                try(OutputStream output=getContentResolver().openOutputStream(data.getData())){if(output==null)throw new IOException("无法写入文件");output.write(text.getBytes(StandardCharsets.UTF_8));notice("文件已保存");}
                catch(Exception e){notice("保存文件失败："+e.getMessage());}
            }
        }
    }
    @Override public void onBackPressed(){
        web.evaluateJavascript("(()=>{const d=document.querySelector('dialog[open]');if(d){d.close();return true;}if(location.hash==='#shopping'){location.hash='#recipes';return true;}return false;})()",handled->{if(!"true".equals(handled))super.onBackPressed();});
    }
    @Override protected void onDestroy(){if(fileCallback!=null)fileCallback.onReceiveValue(null);if(web!=null){web.removeJavascriptInterface("ResonanceNative");web.destroy();}super.onDestroy();}
}
