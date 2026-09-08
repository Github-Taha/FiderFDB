#include <iostream>
#include <fstream>
#include <cstdint>
#include <cstring>
#include <napi.h>
#include "./db.cpp"

using namespace std;

BufferPoolManager buffer_pool_manager;

void print_num ( float num )
{

    cout << "Number: " << num << endl;

}

Napi::Value Initialize ( const Napi::CallbackInfo& info )
{

    Napi::Env env = info.Env();

    buffer_pool_manager = BufferPoolManager();

    return Napi::Boolean::New( env, true );

}

Napi::Value CloseWrapper ( const Napi::CallbackInfo& info )
{

    Napi::Env env = info.Env();

    buffer_pool_manager.Close();

    return env.Null();

}

Napi::Value FetchPageWrapper ( const Napi::CallbackInfo& info )
{

    Napi::Env env = info.Env();

    if ( info.Length() < 2 )
    {
        Napi::TypeError::New( env, "Expected Parameters, 3, for FetchPageWrapper" ).ThrowAsJavaScriptException();
        return env.Null();
    }
    else if ( !info[0].IsString() )
    {
        Napi::TypeError::New( env, "String Expected for File Path" ).ThrowAsJavaScriptException();
        return env.Null();
    }
    else if ( !info[1].IsNumber() )
    {
        Napi::TypeError::New( env, "Number expected for Page ID" ).ThrowAsJavaScriptException();
        return env.Null();
    }

    string file_path = info[0].As<Napi::String>().Utf8Value();
    uint32_t page_id = info[1].As<Napi::Number>().Uint32Value();

    char* raw_page_ptr = buffer_pool_manager.FetchPage( file_path, page_id );

    if ( raw_page_ptr == nullptr ) 
    {
        Napi::Error::New(env, "Failed to fetch page from pool").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Buffer<char> js_shared_buffer = Napi::Buffer<char>::New( env, raw_page_ptr, PAGE_SIZE );

    return js_shared_buffer;
}

Napi::Value SetPageDirtyWrapper( const Napi::CallbackInfo& info )
{
    
    Napi::Env env = info.Env();

    if ( info.Length() < 2 )
    {
        Napi::TypeError::New( env, "Expected Parameters, 3, for FetchPageWrapper" ).ThrowAsJavaScriptException();
        return env.Null();
    }
    else if ( !info[0].IsString() )
    {
        Napi::TypeError::New( env, "String Expected for File Path" ).ThrowAsJavaScriptException();
        return env.Null();
    }
    else if ( !info[1].IsNumber() )
    {
        Napi::TypeError::New( env, "Number expected for Page ID" ).ThrowAsJavaScriptException();
        return env.Null();
    }

    string file_path = info[0].As<Napi::String>().Utf8Value();
    uint32_t page_id = info[1].As<Napi::Number>().Uint32Value();

    buffer_pool_manager.SetPageDirty( file_path, page_id );

    return env.Null();

}

Napi::Value FlushDirtyPagesWrapper( const Napi::CallbackInfo& info )
{
    
    Napi::Env env = info.Env();

    buffer_pool_manager.FlushDirtyPages();

    return env.Null();

}

Napi::Value AddPageWrapper( const Napi::CallbackInfo& info )
{
    
    Napi::Env env = info.Env();

    if ( info.Length() < 2 )
    {
        Napi::TypeError::New( env, "Expected Parameters, 3, for FetchPageWrapper" ).ThrowAsJavaScriptException();
        return env.Null();
    }
    else if ( !info[0].IsString() )
    {
        Napi::TypeError::New( env, "String Expected for File Path" ).ThrowAsJavaScriptException();
        return env.Null();
    }
    else if ( !info[1].IsNumber() )
    {
        Napi::TypeError::New( env, "Number expected for Page ID" ).ThrowAsJavaScriptException();
        return env.Null();
    }

    string file_path = info[0].As<Napi::String>().Utf8Value();
    uint32_t page_id = info[1].As<Napi::Number>().Uint32Value();

    buffer_pool_manager.AddPage( file_path, page_id );

    return env.Null();

}


// Register Function
Napi::Object Init ( Napi::Env env, Napi::Object exports )
{

    exports.Set( "init", Napi::Function::New( env, Initialize ) );
    exports.Set( "getPageBuffer", Napi::Function::New( env, FetchPageWrapper ) );
    exports.Set( "flushDirtyPages", Napi::Function::New( env, FlushDirtyPagesWrapper ) );
    exports.Set( "addPage", Napi::Function::New( env, AddPageWrapper ) );
    exports.Set( "setPageDirty", Napi::Function::New( env, SetPageDirtyWrapper ) );
    exports.Set( "close", Napi::Function::New( env, CloseWrapper ) );

    return exports;

}
NODE_API_MODULE( main, Init );


int main() 
{

    return 0;
}
