package com.test.thalitest;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;

import io.jxcore.node.FileManager;
import static org.junit.Assert.assertThat;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.equalTo;

/**
 * Created by MLesnic on 6/10/2016.
 */
public class FileManagerTest {

    @Before
    public void setUp() throws Exception {
        MockitoAnnotations.initMocks(this);
    }
    @After
    public void tearDown() throws Exception {
    }

    @Test
    public void readFileTest() {
        System.out.println("Inside readFileTest");
        File file = null;
        BufferedWriter bw = null;

        try{
            file = new File("readFileTestTemp.txt");
            bw = new BufferedWriter(new FileWriter(file));

            String testStr = "";
            for(int i = 0;i < 10; i++){
                bw.write("line" + i);
                testStr += "line" + i;
            }
            bw.close();
            String string = FileManager.readFile("readFileTestTemp.txt");

            assertThat(testStr, is(equalTo(string)));

        }catch(Exception e){
        }
        finally {
            file.delete();
        }
    }
}
